import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup";
import { useShardManager } from "../hooks/useShardManager";
import { useGalleryLoader } from "../hooks/useGalleryLoader";

export const GreekVases = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraHeight] = useState(2.5);
  const isPointerLockedRef = useRef(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [brokenVasesCount] = useState(0);
  const [isTouchControlActive, setIsTouchControlActive] = useState(false);
  const textureRefs = useRef<{
    windowTexture: THREE.Texture | null;
    backgroundTexture: THREE.Texture | null;
  }>({
    windowTexture: null,
    backgroundTexture: null,
  });

  // Setup scene, camera, renderer, composer using the hook
  const {
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    setOutlineObjects,
    initializationStatus,
  } = useSceneSetup({
    mountRef,
    cameraHeight: 3,
  });

  // Poprawiono destrukturyzację - galleryModel jest z useGalleryLoader
  const { galleryModel, windowPane, backgroundPlane, directionalLight } =
    useGalleryLoader({
      sceneRef,
      setOutlineObjects,
      initializationStatus,
    });

  const initialBackgroundPosition = useRef<THREE.Vector3 | null>(null);

  // Initialize Vase Manager FIRST
  const { handleVaseClick, setOnVaseBrokenCallback, vasesRef, pedestalsRef } =
    useVaseManager({
      sceneRef,
      cameraRef,
      isPointerLocked: isPointerLockedRef.current,
      onVasesCreated: () => {
        refreshOutlines();
      },
    });

  // Initialize Player Controls SECOND
  const { updatePlayerPosition, joystickCenter, joystickRadius } =
    usePlayerControls({
      isPointerLocked: isPointerLockedRef.current,
      cameraRef,
      cameraHeight,
      setIsTouchControlActive,
      handleVaseClick,
    });

  // Initialize Shard Manager
  const { createShards, updateShards, cleanupShards } = useShardManager({
    sceneRef,
  });

  // Function to refresh outlines
  const refreshOutlines = useCallback(() => {
    if (
      initializationStatus === "ready" &&
      sceneRef.current &&
      vasesRef.current &&
      pedestalsRef.current
    ) {
      const objectsToOutline = [...vasesRef.current, ...pedestalsRef.current];
      console.log(
        "Refreshing outlines with:",
        objectsToOutline.length,
        "objects"
      );
      setOutlineObjects(objectsToOutline);
    } else {
      console.log("Skipping outline refresh, scene not ready or no objects.");
    }
  }, [
    initializationStatus,
    sceneRef,
    vasesRef,
    pedestalsRef,
    setOutlineObjects,
  ]);

  // Add gallery objects to the scene imperatively when they are loaded
  useEffect(() => {
    if (initializationStatus !== "ready" || !sceneRef.current) {
      console.log(
        `Add gallery objects useEffect skipped: status=${initializationStatus}, sceneRef=${!!sceneRef.current}`
      );
      return;
    }
    const scene = sceneRef.current;
    console.log("--- Add Gallery Objects useEffect START ---");
    console.log("Current values:", {
      galleryModel: galleryModel
        ? `${galleryModel.name} (ID: ${galleryModel.uuid.substring(0, 6)})`
        : null,
      windowPane: windowPane
        ? `${windowPane.name} (ID: ${windowPane.uuid.substring(0, 6)})`
        : null,
      backgroundPlane: backgroundPlane
        ? `${backgroundPlane.name} (ID: ${backgroundPlane.uuid.substring(
            0,
            6
          )})`
        : null,
      directionalLight: directionalLight
        ? `${directionalLight.name} (ID: ${directionalLight.uuid.substring(
            0,
            6
          )})`
        : null,
    });

    const objectsToAdd: (THREE.Object3D | null)[] = [
      galleryModel,
      windowPane,
      backgroundPlane,
      directionalLight,
    ];

    objectsToAdd.forEach((obj) => {
      if (obj) {
        if (!obj.parent) {
          console.log(
            `Adding object to scene: ${
              obj.name || obj.type
            } (ID: ${obj.uuid.substring(0, 6)})`
          );
          scene.add(obj);
          if (obj instanceof THREE.DirectionalLight && !obj.target.parent) {
            if (!scene.children.includes(obj.target)) {
              console.log(`Adding light target for ${obj.name} to scene.`);
              scene.add(obj.target);
            } else {
              console.log(`Light target for ${obj.name} already in scene.`);
            }
          }
        } else {
          console.log(
            `Object ${obj.name || obj.type} (ID: ${obj.uuid.substring(
              0,
              6
            )}) already has parent: ${obj.parent.name || obj.parent.type}`
          );
        }
        if (obj === backgroundPlane && !initialBackgroundPosition.current) {
          initialBackgroundPosition.current = obj.position.clone();
          console.log(
            `Initial background position set:`,
            initialBackgroundPosition.current
          );
        }
      } else {
        console.log("Encountered null object in objectsToAdd array.");
      }
    });
    console.log(
      "Scene children after attempting add:",
      scene.children.map((c) => c.name || c.type)
    );

    return () => {
      console.log("--- Add Gallery Objects useEffect CLEANUP --- ");
      objectsToAdd.forEach((obj) => {
        if (obj && obj.parent === scene) {
          console.log(
            `Removing object from scene: ${
              obj.name || obj.type
            } (ID: ${obj.uuid.substring(0, 6)})`
          );
          scene.remove(obj);
          if (
            obj instanceof THREE.DirectionalLight &&
            obj.target.parent === scene
          ) {
            console.log(`Removing light target for ${obj.name} from scene.`);
            scene.remove(obj.target);
          }
        }
      });
      console.log(
        "Scene children after cleanup:",
        scene.children.map((c) => c.name || c.type)
      );
    };
  }, [
    initializationStatus,
    sceneRef,
    galleryModel,
    windowPane,
    backgroundPlane,
    directionalLight,
  ]);

  // Pointer Lock Handlers
  const handlePointerLockChange = useCallback(() => {
    const locked = document.pointerLockElement === mountRef.current;
    console.log("Pointer lock change detected. Locked:", locked);
    setIsPointerLocked(locked);
    isPointerLockedRef.current = locked;
  }, [mountRef]);

  const handlePointerLockError = useCallback(() => {
    console.error("Pointer Lock Error");
    setIsPointerLocked(false);
    isPointerLockedRef.current = false;
  }, []);

  // Main effect for animation loop and non-hook event listeners
  useEffect(() => {
    console.log(
      `--- Animation Loop useEffect START (Status: ${initializationStatus}) ---`
    );

    if (initializationStatus !== "ready") {
      console.log(
        "--- Animation Loop useEffect: Status NOT READY, exiting. ---"
      );
      return;
    }

    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) {
      console.error(
        "--- Animation Loop useEffect: Status READY but refs are NULL! This shouldn't happen. Exiting. ---"
      );
      return;
    }

    console.log("--- Animation Loop useEffect: Status READY, proceeding. ---");

    const currentScene = sceneRef.current;
    const currentRenderer = rendererRef.current;
    const currentCamera = cameraRef.current;
    const currentComposer = composerRef.current;

    // Click handler for pointer lock (DESKTOP ONLY)
    const combinedMouseClickHandler = () => {
      if (!isTouchControlActive && isPointerLockedRef.current) {
        handleVaseClick();
      }
    };

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);

      // Parallax Effect
      if (
        backgroundPlane &&
        initialBackgroundPosition.current &&
        cameraRef.current
      ) {
        const parallaxFactor = 0.1;
        const camera = cameraRef.current;
        const offsetX = -(camera.position.x * parallaxFactor);
        const offsetY = -(camera.position.y * parallaxFactor * 0.5);

        backgroundPlane.position.x =
          initialBackgroundPosition.current.x + offsetX;
        backgroundPlane.position.y =
          initialBackgroundPosition.current.y + offsetY;
        backgroundPlane.position.z = initialBackgroundPosition.current.z;
      }

      // Update player position
      if (isPointerLockedRef.current || isTouchControlActive) {
        updatePlayerPosition();
      }

      updateShards();

      // Vase Levitation
      const time = performance.now() * 0.001;
      const levitationSpeed = 1.5;
      const levitationAmplitude = 0.05;
      const levitationBaseOffset = 0.15;

      if (vasesRef.current) {
        vasesRef.current.forEach((vase) => {
          if (
            vase.userData.initialY !== undefined &&
            vase.userData.phaseOffset !== undefined
          ) {
            const initialY = vase.userData.initialY;
            const phaseOffset = vase.userData.phaseOffset;
            const offsetY =
              Math.sin(time * levitationSpeed + phaseOffset) *
              levitationAmplitude;
            vase.position.y = initialY + levitationBaseOffset + offsetY;
          }
        });
      }

      // Render scene (przywrócono renderowanie przez composer)
      if (currentComposer) {
        currentComposer.render();
      } else {
        console.warn("Composer not found, using direct renderer");
        currentRenderer.render(currentScene, currentCamera);
      }
    }

    console.log("--- Animation Loop useEffect: Starting animation loop... ---");
    animate();

    // Event Listeners
    const handleMountClick = () => {
      if (!isTouchControlActive && !isPointerLocked) {
        console.log("Requesting pointer lock via mount click...");
        mountRef.current?.requestPointerLock();
      }
    };
    if (mountRef.current) {
      mountRef.current.addEventListener("click", handleMountClick);
    }
    window.addEventListener("click", combinedMouseClickHandler);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    // Cleanup
    return () => {
      console.log("--- Animation Loop useEffect CLEANUP --- ");
      if (mountRef.current) {
        mountRef.current.removeEventListener("click", handleMountClick);
      }
      window.removeEventListener("click", combinedMouseClickHandler);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      cleanupShards();
      cancelAnimationFrame(animationId);
    };
  }, [
    initializationStatus,
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    isTouchControlActive,
    handlePointerLockChange,
    handlePointerLockError,
    updatePlayerPosition,
    handleVaseClick,
    updateShards,
    cleanupShards,
    backgroundPlane,
  ]);

  // Effect to set outline objects when vases are ready
  useEffect(() => {
    if (initializationStatus === "ready") {
      refreshOutlines();
    }
  }, [
    initializationStatus,
    vasesRef.current,
    pedestalsRef.current,
    refreshOutlines,
  ]);

  // Connect Vase Manager break event to Shard Manager creation
  useEffect(() => {
    setOnVaseBrokenCallback((info) => {
      createShards(info);
      refreshOutlines();
    });
    return () => setOnVaseBrokenCallback(() => {});
  }, [setOnVaseBrokenCallback, createShards, refreshOutlines]);

  // Cleanup textures when component unmounts
  useEffect(() => {
    return () => {
      if (textureRefs.current.windowTexture) {
        textureRefs.current.windowTexture.dispose();
        textureRefs.current.windowTexture = null;
      }
      if (textureRefs.current.backgroundTexture) {
        textureRefs.current.backgroundTexture.dispose();
        textureRefs.current.backgroundTexture = null;
      }
    };
  }, []);

  return (
    <div className="greek-vases-container">
      <div ref={mountRef} className="canvas-container" />
      <div className="broken-vases-counter" data-testid="broken-vases-counter">
        Broken Vases: {brokenVasesCount}
      </div>
      <div className="controls-info" data-testid="controls-info">
        Użyj WSAD, aby się poruszać. Kliknij, aby rozbić wazę.
      </div>
      <div
        className={`crosshair ${isPointerLocked ? "active" : ""}`}
        data-testid="crosshair"
      />

      {isTouchControlActive && joystickCenter && joystickRadius > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${joystickCenter.x}px`,
            top: `${joystickCenter.y}px`,
            width: `${joystickRadius * 2}px`,
            height: `${joystickRadius * 2}px`,
            borderRadius: "50%",
            border: "1px dotted rgba(0, 0, 0, 0.3)",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(3px)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
          data-testid="joystick-area"
        />
      )}

      {!isPointerLocked && !isTouchControlActive && (
        <div className="instruction-overlay" data-testid="instruction-overlay">
          Kliknij, aby rozpocząć
        </div>
      )}
    </div>
  );
};

export default GreekVases;
