import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import {
  createPedestal,
  createVaseOnPedestal,
  playBreakSound,
} from "../features/greek-vases/threeUtils";

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

  // Callback to notify about a broken vase (for shard creation)
  const onVaseBrokenRef = useRef<(info: BrokenVaseInfo) => void>(() => {});

  // Initialize pedestals and vases
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clear previous vases if any (e.g., on hot reload or component remount)
    vasesRef.current.forEach((vase) => vase.parent?.remove(vase));
    vasesRef.current = [];
    brokenVasesSetRef.current.clear();

    const newVases: THREE.Mesh[] = [];
    for (let i = -5; i <= 5; i += 2.5) {
      const leftPedestal = createPedestal(-5, i * 2);
      const rightPedestal = createPedestal(5, i * 2);

      scene.add(leftPedestal);
      scene.add(rightPedestal);

      const leftVase = createVaseOnPedestal(leftPedestal, -5, i * 2);
      const rightVase = createVaseOnPedestal(rightPedestal, 5, i * 2);
      newVases.push(leftVase, rightVase);
    }
    vasesRef.current = newVases; // Update the ref with the created vases

    // Simple cleanup for pedestals and vases added by this effect
    return () => {
      if (sceneRef.current) {
        newVases.forEach((vase) => vase.parent?.removeFromParent()); // Remove vases
        // Pedestals are harder to track cleanly here without more state,
        // assuming full scene cleanup happens elsewhere for now.
      }
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

          // Remove vase from scene
          vase.parent?.remove(vase);

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
