import { useRef, useEffect, useState, useCallback } from "react";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup";
import { useShardManager } from "../hooks/useShardManager";
import { useGalleryLoader } from "../hooks/useGalleryLoader";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
// Remove empty import block
// import {
// } from "../features/greek-vases/threeUtils";

const GreekVases = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraHeight] = useState(2.5);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

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

  // Add returned objects to the scene imperatively when they are loaded
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

  // Pass refs from useSceneSetup to other hooks
  const { updatePlayerPosition } = usePlayerControls({
    isPointerLocked,
    cameraRef,
    cameraHeight,
  });

  // Shard Manager Hook - Needs sceneRef
  const { createShards, updateShards, cleanupShards } = useShardManager({
    sceneRef,
  });

  // Vase Manager Hook - Needs sceneRef, cameraRef, and setOnVaseBrokenCallback now uses createShards
  const { brokenVasesCount, handleVaseClick, setOnVaseBrokenCallback } =
    useVaseManager({
      sceneRef,
      cameraRef,
      isPointerLocked,
    });

  // Connect Vase Manager break event to Shard Manager creation
  useEffect(() => {
    setOnVaseBrokenCallback(createShards);
    // Cleanup callback connection if component unmounts or deps change
    return () => setOnVaseBrokenCallback(() => {});
  }, [setOnVaseBrokenCallback, createShards]);

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

    // Click handler for pointer lock and vase breaking
    const combinedMouseClickHandler = () => {
      if (!isPointerLocked) {
        mountRef.current?.requestPointerLock();
      } else {
        handleVaseClick();
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

      if (isPointerLocked) {
        updatePlayerPosition();
      }

      updateShards();
      renderer.render(scene, camera);
    }
    animate();

    // Event Listeners
    window.addEventListener("click", combinedMouseClickHandler);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    // Cleanup
    return () => {
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
    handlePointerLockChange,
    handlePointerLockError,
    updatePlayerPosition,
    handleVaseClick,
    sceneRef,
    cameraRef,
    rendererRef,
    updateShards,
    cleanupShards,
    backgroundPlane,
  ]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#000", // Consider moving styles to CSS
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

      {/* New Instruction Text - Visible only when pointer is not locked */}
      {!isPointerLocked && (
        <div className="instruction-overlay" data-testid="instruction-overlay">
          Kliknij, aby rozpocząć
        </div>
      )}
    </div>
  );
};

export default GreekVases;
