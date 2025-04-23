import { useRef, useCallback } from "react";
import * as THREE from "three";

// Define types for clarity
interface ShardManagerProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
}

interface ShardInfo {
  position: THREE.Vector3;
  shardColor: THREE.Color;
}

// Define structure for shard user data
interface ShardUserData {
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  onGround: boolean;
}

export const useShardManager = ({ sceneRef }: ShardManagerProps) => {
  const shardsRef = useRef<THREE.Mesh[]>([]);

  // Function to create shards at a given position and color
  const createShards = useCallback(
    (info: ShardInfo) => {
      if (!sceneRef.current) return;
      const scene = sceneRef.current;
      const { position: worldPosition, shardColor } = info;

      const numberOfShards = 12 + Math.floor(Math.random() * 8);
      const newShards: THREE.Mesh[] = [];

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
            shardColor.r + (Math.random() * 0.1 - 0.05),
            shardColor.g + (Math.random() * 0.1 - 0.05),
            shardColor.b + (Math.random() * 0.1 - 0.05)
          ),
          roughness: 0.6 + Math.random() * 0.3,
          metalness: 0.1 + Math.random() * 0.1,
        });

        const shard = new THREE.Mesh(geometry, material);
        shard.castShadow = true; // Shards can cast shadows

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

        // Assign typed user data
        shard.userData = {
          velocity: velocity,
          rotationSpeed: new THREE.Vector3(
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.15
          ),
          onGround: false,
        } as ShardUserData;

        scene.add(shard);
        newShards.push(shard);
      }

      // Add the newly created shards to the main ref array
      shardsRef.current.push(...newShards);
    },
    [sceneRef]
  ); // Dependency: sceneRef

  // Function to update shard physics in the animation loop
  const updateShards = useCallback(() => {
    if (!sceneRef.current) return;

    for (let i = shardsRef.current.length - 1; i >= 0; i--) {
      const shard = shardsRef.current[i];
      const userData = shard.userData as ShardUserData; // Type assertion

      if (userData.onGround) continue;

      shard.position.add(userData.velocity);
      shard.rotation.x += userData.rotationSpeed.x;
      shard.rotation.y += userData.rotationSpeed.y;
      shard.rotation.z += userData.rotationSpeed.z;

      userData.velocity.y -= 0.01; // Gravity

      if (shard.position.y < 0.05) {
        shard.position.y = 0.05;
        userData.velocity.y = -userData.velocity.y * 0.3; // Bounce

        // Apply friction only if moving horizontally significantly
        if (
          Math.abs(userData.velocity.x) > 0.001 ||
          Math.abs(userData.velocity.z) > 0.001
        ) {
          userData.velocity.x *= 0.7; // Increased friction
          userData.velocity.z *= 0.7; // Increased friction
        } else {
          // If horizontal movement is negligible, stop it completely
          userData.velocity.x = 0;
          userData.velocity.z = 0;
        }

        // Stop bouncing if vertical velocity is very low
        if (Math.abs(userData.velocity.y) < 0.01) {
          userData.velocity.y = 0;
        }

        // Check if the shard is essentially stopped on the ground
        if (
          Math.abs(userData.velocity.y) < 0.003 && // Check vertical velocity is near zero
          userData.velocity.lengthSq() < 0.00001 // Check overall speed is very low
        ) {
          userData.onGround = true;
          userData.velocity.set(0, 0, 0);
          userData.rotationSpeed.set(0, 0, 0);

          // Removed the setTimeout for automatic shard removal
          // Shards will now remain on the ground indefinitely
        }
      }
    }
  }, [sceneRef]); // Dependency: sceneRef

  // Function to handle cleanup (e.g., removing remaining shards on unmount)
  const cleanupShards = useCallback(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    shardsRef.current.forEach((shard) => {
      scene.remove(shard);
      if (shard.geometry) shard.geometry.dispose();
      if (shard.material instanceof THREE.Material) shard.material.dispose();
      else if (Array.isArray(shard.material)) {
        shard.material.forEach((m) => m.dispose());
      }
    });
    shardsRef.current = []; // Clear the array
  }, [sceneRef]);

  return {
    createShards,
    updateShards,
    cleanupShards, // Expose cleanup function
  };
};
