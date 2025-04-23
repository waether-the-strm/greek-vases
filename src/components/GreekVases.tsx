import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup";
import { useShardManager } from "../hooks/useShardManager";
import { useGalleryLoader } from "../hooks/useGalleryLoader";

const GreekVases = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraHeight] = useState(2.5);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [isTouchControlActive, setIsTouchControlActive] = useState(false);

  // Setup scene, camera, renderer using the hook
  const { sceneRef, cameraRef, rendererRef } = useSceneSetup({
    mountRef,
    cameraHeight,
  });

  // Load the gallery model and other elements using the updated hook
  const { windowPane, backgroundPlane, directionalLight } = useGalleryLoader({
    sceneRef,
  });

  // Store initial background position for parallax
  const initialBackgroundPosition = useRef<THREE.Vector3 | null>(null);

  // Initialize Vase Manager FIRST to get handleVaseClick
  const { brokenVasesCount, handleVaseClick, setOnVaseBrokenCallback } =
    useVaseManager({
      sceneRef,
      cameraRef,
      isPointerLocked,
    });

  // Initialize Player Controls SECOND, passing handleVaseClick
  const { updatePlayerPosition, joystickCenter, joystickRadius } =
    usePlayerControls({
      isPointerLocked,
      cameraRef,
      cameraHeight,
      setIsTouchControlActive,
      handleVaseClick, // Pass the vase click handler
    });

  // Initialize Shard Manager
  const { createShards, updateShards, cleanupShards } = useShardManager({
    sceneRef,
  });

  // Add gallery objects to the scene imperatively when they are loaded
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const objectsToAdd: (THREE.Object3D | null)[] = [
      windowPane,
      backgroundPlane,
      directionalLight,
    ];

    objectsToAdd.forEach((obj) => {
      if (obj) {
        // If directional light, increase intensity before adding
        if (obj instanceof THREE.DirectionalLight) {
          obj.intensity = 2.0; // Increased intensity
        }

        scene.add(obj);
        // If directional light, also add its target if not already parented
        if (obj instanceof THREE.DirectionalLight && !obj.target.parent) {
          scene.add(obj.target);
        }
        // Store initial background position once loaded
        if (obj === backgroundPlane && !initialBackgroundPosition.current) {
          initialBackgroundPosition.current = obj.position.clone();
        }
      }
    });

    // Cleanup: remove objects when component unmounts or objects change
    return () => {
      objectsToAdd.forEach((obj) => {
        if (obj && obj.parent === scene) {
          scene.remove(obj);
          if (obj instanceof THREE.DirectionalLight) {
            scene.remove(obj.target);
          }
        }
      });
    };
  }, [sceneRef, windowPane, backgroundPlane, directionalLight]); // Rerun when objects are loaded

  // Pointer Lock Handlers
  const handlePointerLockChange = useCallback(() => {
    setIsPointerLocked(document.pointerLockElement === mountRef.current);
  }, [mountRef]);

  const handlePointerLockError = useCallback(() => {
    console.error("Pointer Lock Error");
  }, []);

  // Main effect for animation loop and non-hook event listeners
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    // Click handler for pointer lock (DESKTOP ONLY)
    const combinedMouseClickHandler = () => {
      // Only handle clicks if touch is NOT active (i.e., on desktop)
      if (!isTouchControlActive) {
        if (!isPointerLocked) {
          mountRef.current?.requestPointerLock();
        } else {
          // Call handleVaseClick directly ONLY when pointer is locked
          handleVaseClick();
        }
      }
    };

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);

      // --- Parallax Effect --- Moved inside animate loop
      if (
        backgroundPlane &&
        initialBackgroundPosition.current &&
        cameraRef.current
      ) {
        const parallaxFactor = 0.1; // Adjust for desired effect strength
        const camera = cameraRef.current;
        // Calculate offset based on camera's deviation from origin (or initial pos)
        const offsetX = -(camera.position.x * parallaxFactor);
        // We might not want vertical parallax, or use a different factor
        const offsetY = -(camera.position.y * parallaxFactor * 0.5); // Example Y parallax

        backgroundPlane.position.x =
          initialBackgroundPosition.current.x + offsetX;
        backgroundPlane.position.y =
          initialBackgroundPosition.current.y + offsetY;
        backgroundPlane.position.z = initialBackgroundPosition.current.z;
      }
      // --- End Parallax ---

      // Update player position if pointer is locked (desktop) OR touch control is active (state)
      if (isPointerLocked || isTouchControlActive) {
        // Remove temporary log
        updatePlayerPosition();
      }

      updateShards();
      renderer.render(scene, camera);
    }
    animate();

    // Event Listeners - Click listener is now only for desktop
    window.addEventListener("click", combinedMouseClickHandler);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    // Cleanup
    return () => {
      // Remove desktop click listener
      window.removeEventListener("click", combinedMouseClickHandler);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("pointerlockerror", handlePointerLockError);

      // Explicit cleanup call for shards remains as a safeguard
      cleanupShards();

      cancelAnimationFrame(animationId);
    };
  }, [
    isPointerLocked,
    isTouchControlActive,
    handlePointerLockChange,
    handlePointerLockError,
    updatePlayerPosition,
    handleVaseClick, // Ensure handleVaseClick is listed explicitly
    sceneRef,
    cameraRef,
    rendererRef,
    updateShards,
    cleanupShards,
    backgroundPlane,
  ]);

  // Connect Vase Manager break event to Shard Manager creation
  useEffect(() => {
    setOnVaseBrokenCallback(createShards);
    // Cleanup callback connection if component unmounts or deps change
    return () => setOnVaseBrokenCallback(() => {});
  }, [setOnVaseBrokenCallback, createShards]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#000",
        touchAction: "none", // Add this to prevent default touch behaviors
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          color: "#fff",
          padding: "10px",
          background: "rgba(0,0,0,0.5)",
          borderRadius: "5px",
        }}
        data-testid="broken-vases-counter"
      >
        Broken Vases: {brokenVasesCount}
      </div>
      <div className="controls-info" data-testid="controls-info">
        Użyj WASD, aby się poruszać. Kliknij, aby rozbić wazę.
      </div>
      <div
        className={`crosshair ${isPointerLocked ? "active" : ""}`}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "20px",
          height: "20px",
          border: "2px solid white",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          opacity: isPointerLocked ? 1 : 0,
        }}
        data-testid="crosshair"
      />

      {/* Joystick Visual Indicator - Render only when touch active and geometry available */}
      {isTouchControlActive && joystickCenter && joystickRadius > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${joystickCenter.x}px`,
            top: `${joystickCenter.y}px`,
            width: `${joystickRadius * 2}px`, // Diameter
            height: `${joystickRadius * 2}px`, // Diameter
            borderRadius: "50%",
            // Change border to thin, dark, semi-transparent
            border: "1px dotted rgba(0, 0, 0, 0.3)",
            // Keep background slightly visible and blurred
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(3px)",
            transform: "translate(-50%, -50%)", // Center the circle on the coordinates
            pointerEvents: "none", // Make it non-interactive
          }}
          data-testid="joystick-area"
        />
      )}

      {/* New Instruction Text - Visible only if pointer is NOT locked AND touch control is NOT active (using state) */}
      {!isPointerLocked && !isTouchControlActive && (
        <div className="instruction-overlay" data-testid="instruction-overlay">
          Kliknij, aby rozpocząć
        </div>
      )}
    </div>
  );
};

export default GreekVases;
