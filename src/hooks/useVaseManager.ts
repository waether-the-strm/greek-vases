import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import {
  createPedestal,
  createVaseOnPedestal,
  playBreakSound,
} from "../features/greek-vases/threeUtils";

// Function to recursively dispose of object resources
const disposeObject = (object: THREE.Object3D) => {
  if (object instanceof THREE.Mesh) {
    if (object.geometry) {
      object.geometry.dispose();
    }
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => {
          if (material.map) material.map.dispose();
          // Dispose other maps if needed (normalMap, envMap, etc.)
          material.dispose();
        });
      } else {
        if (object.material.map) object.material.map.dispose();
        // Dispose other maps if needed
        object.material.dispose();
      }
    }
  }
  // Recursively dispose children
  while (object.children.length > 0) {
    disposeObject(object.children[0]);
    object.remove(object.children[0]); // Remove child after disposal
  }
};

// Define types for clarity
interface VaseManagerProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  isPointerLocked: boolean;
  initialBrokenVases?: number;
}

interface BrokenVaseInfo {
  position: THREE.Vector3;
  color: THREE.Color;
}

export const useVaseManager = ({
  sceneRef,
  cameraRef,
  isPointerLocked,
  initialBrokenVases = 0,
}: VaseManagerProps) => {
  const [brokenVasesCount, setBrokenVasesCount] =
    useState<number>(initialBrokenVases);
  const vasesRef = useRef<THREE.Mesh[]>([]); // Use ref to store the array of vase meshes
  const brokenVasesSetRef = useRef<Set<THREE.Mesh>>(new Set()); // Use ref for the set of broken vases
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pedestalsRef = useRef<THREE.Group[]>([]); // Ref to store pedestals

  // Callback to notify about a broken vase (for shard creation)
  const onVaseBrokenRef = useRef<(info: BrokenVaseInfo) => void>(() => {});

  // Initialize pedestals and vases
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clear previous objects managed by this hook
    pedestalsRef.current.forEach((p) => {
      scene.remove(p);
      disposeObject(p); // Dispose pedestal and its children
    });
    pedestalsRef.current = [];
    vasesRef.current = []; // Vases are children of pedestals, disposed above
    brokenVasesSetRef.current.clear();

    const newVases: THREE.Mesh[] = [];
    const newPedestals: THREE.Group[] = [];

    for (let i = -5; i <= 5; i += 2.5) {
      const leftPedestal = createPedestal(-5, i * 2);
      const rightPedestal = createPedestal(5, i * 2);

      scene.add(leftPedestal);
      scene.add(rightPedestal);
      newPedestals.push(leftPedestal, rightPedestal);

      const leftVase = createVaseOnPedestal(leftPedestal, -5, i * 2);
      const rightVase = createVaseOnPedestal(rightPedestal, 5, i * 2);
      newVases.push(leftVase, rightVase);
    }
    vasesRef.current = newVases;
    pedestalsRef.current = newPedestals; // Store pedestals

    // Cleanup function for this effect
    return () => {
      const currentScene = sceneRef.current; // Capture sceneRef value
      // Check if scene still exists during cleanup
      if (currentScene) {
        pedestalsRef.current.forEach((p) => {
          currentScene.remove(p); // Remove from the scene
          disposeObject(p); // Dispose pedestal and its children (including textures)
        });
      }
      // Clear refs
      pedestalsRef.current = [];
      vasesRef.current = [];
      brokenVasesSetRef.current.clear();
    };
  }, [sceneRef]); // Run only when sceneRef changes (effectively once on mount)

  // Function to handle vase breaking logic
  const handleVaseClick = useCallback(() => {
    if (!isPointerLocked || !cameraRef.current || !sceneRef.current) return;

    raycasterRef.current.setFromCamera(new THREE.Vector2(), cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(
      vasesRef.current,
      false
    );

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (intersectedObject instanceof THREE.Mesh) {
        const vase = intersectedObject;

        if (!brokenVasesSetRef.current.has(vase)) {
          brokenVasesSetRef.current.add(vase);
          setBrokenVasesCount((prev) => prev + 1);

          const worldPosition = new THREE.Vector3();
          vase.getWorldPosition(worldPosition);

          const baseMaterial = vase.material as THREE.MeshStandardMaterial;
          const baseColor =
            baseMaterial.color?.clone() || new THREE.Color(0xe8b27d);

          // IMPORTANT: Dispose vase resources BEFORE removing from parent
          if (baseMaterial.map) {
            baseMaterial.map.dispose(); // Dispose vase texture
          }
          baseMaterial.dispose();
          if (vase.geometry) {
            vase.geometry.dispose();
          }

          // Remove vase from scene (parent pedestal)
          vase.removeFromParent();

          // Remove vase from the internal ref array
          vasesRef.current = vasesRef.current.filter((v) => v !== vase);

          playBreakSound();

          // Notify that a vase was broken for shard creation
          onVaseBrokenRef.current({
            position: worldPosition,
            color: baseColor,
          });
        }
      }
    }
  }, [isPointerLocked, cameraRef, sceneRef]); // Dependencies for the click handler

  return {
    brokenVasesCount,
    handleVaseClick,
    // Function allowing external systems (like shard manager) to subscribe to vase break events
    setOnVaseBrokenCallback: (callback: (info: BrokenVaseInfo) => void) => {
      onVaseBrokenRef.current = callback;
    },
  };
};
