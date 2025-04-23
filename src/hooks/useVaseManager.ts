import { useState, useRef, useCallback, useEffect } from "react";
import * as THREE from "three";
import {
  createPedestal,
  createVaseOnPedestal,
  playBreakSound,
} from "../features/greek-vases/threeUtils";

// Define the pastel color palette (for pedestals)
const pastelPalette = [
  0xffb3ba, // light pink
  0xffdfba, // light peach
  0xffffba, // light yellow
  0xbaffc9, // light green
  0xbae1ff, // light blue
  0xe0bbe4, // light purple
];

// Define types for clarity
// Update BrokenVaseInfo to use shardColor
interface BrokenVaseInfo {
  position: THREE.Vector3;
  shardColor: THREE.Color;
}

interface VaseManagerProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  isPointerLocked: boolean;
  initialBrokenVases?: number;
}

// --- Function to Apply Pastel Colors to Pedestals ---
// Modified to return the applied color
const applyPastelToPedestal = (
  pedestal: THREE.Group,
  vaseToIgnore: THREE.Mesh
): number => {
  const colorHex =
    pastelPalette[Math.floor(Math.random() * pastelPalette.length)];
  pedestal.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child !== vaseToIgnore &&
      child.material &&
      !Array.isArray(child.material)
    ) {
      (child.material as THREE.MeshStandardMaterial).color.set(colorHex);
    }
  });
  return colorHex; // Return the applied color hex value
};
// --- End Function Definition ---

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

      // Create vases using the original function call
      const leftVase = createVaseOnPedestal(leftPedestal, -5, i * 2);
      const rightVase = createVaseOnPedestal(rightPedestal, 5, i * 2);

      // Apply pastel colors to PEDESTALS and store the color in vase userData
      let leftPedestalColor = 0xffffff; // Default color
      let rightPedestalColor = 0xffffff;
      if (leftVase) {
        leftPedestalColor = applyPastelToPedestal(leftPedestal, leftVase);
        leftVase.userData.pedestalColor = leftPedestalColor; // Store color
      }
      if (rightVase) {
        rightPedestalColor = applyPastelToPedestal(rightPedestal, rightVase);
        rightVase.userData.pedestalColor = rightPedestalColor; // Store color
      }

      // --- Adjust Vase Material Properties ---
      const adjustVaseMaterial = (vase: THREE.Mesh) => {
        if (vase.material && !Array.isArray(vase.material)) {
          const material = vase.material as THREE.MeshStandardMaterial;
          material.roughness = 0.9; // More matte
          material.metalness = 0.1; // Less metallic
        }
      };
      if (leftVase) adjustVaseMaterial(leftVase);
      if (rightVase) adjustVaseMaterial(rightVase);
      // --- End Adjust Vase Material ---

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

          // Retrieve pedestal color from userData
          const pedestalColorHex = vase.userData.pedestalColor || 0xffffff; // Use stored color or white fallback
          const shardColor = new THREE.Color(pedestalColorHex);

          // IMPORTANT: Dispose vase resources BEFORE removing from parent
          if (vase.material && !Array.isArray(vase.material)) {
            const baseMaterial = vase.material as THREE.MeshStandardMaterial;
            if (baseMaterial.map) {
              baseMaterial.map.dispose(); // Dispose vase texture
            }
            baseMaterial.dispose();
            if (vase.geometry) {
              vase.geometry.dispose();
            }
          }

          // Remove vase from scene (parent pedestal)
          vase.removeFromParent();

          // Remove vase from the internal ref array
          vasesRef.current = vasesRef.current.filter((v) => v !== vase);

          playBreakSound();

          // Notify that a vase was broken for shard creation, passing pedestal color
          onVaseBrokenRef.current({
            position: worldPosition,
            shardColor: shardColor, // Pass the pedestal color as shardColor
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
