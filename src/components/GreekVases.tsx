import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { PlayerState, usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup"; // Import Scene Setup hook
// Import utilities
import // createPedestal,
// createVaseOnPedestal,
// playBreakSound,
// vaseNames, createVaseTexture, createVaseGeometry are used internally by the above
"../features/greek-vases/threeUtils";

const GreekVases = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraHeight] = useState(2.5);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // Setup scene, camera, renderer using the hook
  const { sceneRef, cameraRef, rendererRef } = useSceneSetup({
    mountRef,
    cameraHeight,
  });

  // Pass refs from useSceneSetup to other hooks
  const { updatePlayerPosition } = usePlayerControls({
    isPointerLocked,
    cameraRef,
    cameraHeight,
  });

  const { brokenVasesCount, handleVaseClick, setOnVaseBrokenCallback } =
    useVaseManager({
      sceneRef,
      cameraRef,
      isPointerLocked,
    });

  // Helper functions for lights, floor, walls (can be moved to scene setup or utils later)
  const setupLights = (scene: THREE.Scene) => {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -15;
    directionalLight.shadow.camera.right = 15;
    directionalLight.shadow.camera.top = 15;
    directionalLight.shadow.camera.bottom = -15;
    directionalLight.shadow.radius = 4;
    directionalLight.shadow.bias = -0.0005;
    scene.add(directionalLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 8, -7.5);
    fillLight.castShadow = false;
    scene.add(fillLight);
  };

  const setupFloor = (scene: THREE.Scene) => {
    const floorGeometry = new THREE.BoxGeometry(10, 0.2, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,
      roughness: 0.5,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);
  };

  const setupWalls = (scene: THREE.Scene) => {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.2,
    });
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 5, 30),
      wallMaterial
    );
    leftWall.position.set(-10, 2.5, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 5, 30),
      wallMaterial
    );
    rightWall.position.set(10, 2.5, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);
  };

  // Handlers for pointer lock
  const handlePointerLockChange = useCallback(() => {
    setIsPointerLocked(document.pointerLockElement === mountRef.current);
  }, []);

  const handlePointerLockError = useCallback(() => {
    console.error("Pointer Lock Error");
  }, []);

  useEffect(() => {
    // Ensure scene is ready before setting up other elements
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;

    // Restore local shards array declaration for temporary use
    const shards: THREE.Mesh[] = [];

    // Setup lights, floor, walls (consider moving to useSceneSetup or separate hook)
    setupLights(scene);
    setupFloor(scene);
    setupWalls(scene);

    // Callback for vase breaking -> shard creation (temp location)
    const createShardsOnBreak = (info: {
      position: THREE.Vector3;
      color: THREE.Color;
    }) => {
      const { position: worldPosition, color: baseColor } = info;
      const numberOfShards = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i < numberOfShards; i++) {
        let geometry;
        const shapeType = Math.floor(Math.random() * 4);
        const shardSize = 0.05 + Math.random() * 0.15;
        switch (shapeType) {
          case 0:
            geometry = new THREE.TetrahedronGeometry(shardSize);
            break;
          case 1:
            geometry = new THREE.BoxGeometry(
              shardSize * (1 + Math.random()),
              shardSize * (0.2 + Math.random() * 0.5),
              shardSize * (1 + Math.random())
            );
            break;
          case 2:
            geometry = new THREE.ConeGeometry(
              shardSize * (0.8 + Math.random() * 0.4),
              shardSize * (1.5 + Math.random()),
              4 + Math.floor(Math.random() * 4)
            );
            break;
          default:
            geometry = new THREE.OctahedronGeometry(shardSize, 0);
            break;
        }
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(
            baseColor.r + (Math.random() * 0.1 - 0.05),
            baseColor.g + (Math.random() * 0.1 - 0.05),
            baseColor.b + (Math.random() * 0.1 - 0.05)
          ),
          roughness: 0.6 + Math.random() * 0.3,
          metalness: 0.1 + Math.random() * 0.1,
        });
        const shard = new THREE.Mesh(geometry, material);
        shard.position.copy(worldPosition);
        shard.position.x += (Math.random() - 0.5) * 0.1;
        shard.position.y += (Math.random() - 0.5) * 0.1;
        shard.position.z += (Math.random() - 0.5) * 0.1;
        const speedMagnitude = 0.05 + Math.random() * 0.1;
        const velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 2,
          0.5 + Math.random() * 0.5,
          (Math.random() - 0.5) * 2
        );
        velocity.normalize().multiplyScalar(speedMagnitude);
        shard.userData = {
          velocity: velocity,
          rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
          ),
          onGround: false,
        };
        scene.add(shard);
        shards.push(shard);
      }
    };
    setOnVaseBrokenCallback(createShardsOnBreak);

    // Shard update logic (temp location)
    function updateShards() {
      for (let i = shards.length - 1; i >= 0; i--) {
        const shard = shards[i];
        const userData = shard.userData;
        if (userData.onGround) continue;
        shard.position.add(userData.velocity);
        shard.rotation.x += userData.rotationSpeed.x;
        shard.rotation.y += userData.rotationSpeed.y;
        shard.rotation.z += userData.rotationSpeed.z;
        userData.velocity.y -= 0.01;
        if (shard.position.y < 0.05) {
          shard.position.y = 0.05;
          userData.velocity.y = -userData.velocity.y * 0.3;
          userData.velocity.x *= 0.8;
          userData.velocity.z *= 0.8;
          if (
            Math.abs(userData.velocity.y) < 0.005 &&
            userData.velocity.lengthSq() < 0.0001
          ) {
            userData.onGround = true;
            userData.velocity.set(0, 0, 0);
            userData.rotationSpeed.set(0, 0, 0);
          }
        }
      }
    }

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
    // Start the animation loop
    animate(); // Call once to start

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

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });

      cancelAnimationFrame(animationId);
    };
  }, [
    isPointerLocked,
    handlePointerLockChange,
    handlePointerLockError,
    updatePlayerPosition,
    handleVaseClick,
    setOnVaseBrokenCallback,
    sceneRef,
    cameraRef,
    rendererRef,
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
    </div>
  );
};

export default GreekVases;
