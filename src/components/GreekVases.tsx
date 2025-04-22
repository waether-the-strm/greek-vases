import { useRef, useEffect, useState, useCallback } from "react";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup";
import { useShardManager } from "../hooks/useShardManager";
import { useGalleryLoader } from "../hooks/useGalleryLoader";
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

  // Load the gallery model using the new hook
  useGalleryLoader({ sceneRef });

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
