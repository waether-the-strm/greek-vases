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
// Define BrokenVaseInfo locally since it's used but not imported
interface BrokenVaseInfo {
  position: THREE.Vector3;
  color: THREE.Color;
}

interface VaseManagerProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  isPointerLocked: boolean;
  initialBrokenVases?: number;
}

// --- Function to Apply Pastel Colors to Pedestals (Moved Before Loop) ---
const applyPastelToPedestal = (
  pedestal: THREE.Group,
  vaseToIgnore: THREE.Mesh
) => {
  const color = pastelPalette[Math.floor(Math.random() * pastelPalette.length)];
  pedestal.traverse((child) => {
    // Check if child is a Mesh, NOT the specific vase to ignore, and has a single material
    if (
      child instanceof THREE.Mesh &&
      child !== vaseToIgnore && // <<< CHANGE: Compare directly with the vase object
      child.material &&
      !Array.isArray(child.material)
    ) {
      // Assuming pedestal material is MeshStandardMaterial or similar
      (child.material as THREE.MeshStandardMaterial).color.set(color);
    }
  });
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

      // Apply pastel colors to PEDESTALS, ignoring the specific vase
      if (leftVase) applyPastelToPedestal(leftPedestal, leftVase);
      if (rightVase) applyPastelToPedestal(rightPedestal, rightVase);

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

          // Assuming vase.material is MeshStandardMaterial or similar
          const baseMaterial = vase.material as THREE.MeshStandardMaterial;
          // Use the actual vase color if available, otherwise fallback to white
          const baseColor =
            baseMaterial.color?.clone() || new THREE.Color(0xffffff); // Keep fallback as white

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
