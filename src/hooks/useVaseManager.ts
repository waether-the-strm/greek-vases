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
  onVasesCreated?: () => void;
}

// Define return type including vasesRef
interface VaseManagerResult {
  brokenVasesCount: number;
  handleVaseClick: (coordsNDC?: THREE.Vector2) => void;
  setOnVaseBrokenCallback: (callback: (info: BrokenVaseInfo) => void) => void;
  vasesRef: React.RefObject<THREE.Mesh[]>;
  pedestalsRef: React.RefObject<THREE.Group[]>;
  onVasesCreated?: () => void;
}

// --- Function to Apply Pastel Colors to Pedestals ---
// Modified to return the applied color
const applyPastelToPedestal = (pedestal: THREE.Group, vase: THREE.Mesh) => {
  // Generuj pastelowy kolor bazowy
  const hue = Math.random();
  const saturation = 0.3 + Math.random() * 0.2; // Delikatna saturacja dla efektu pastelowego
  const lightness = 0.8 + Math.random() * 0.15; // Wysoka jasność dla efektu pastelowego
  const color = new THREE.Color().setHSL(hue, saturation, lightness);

  // Aplikuj kolor do wazy
  if (vase.material instanceof THREE.MeshStandardMaterial) {
    vase.material.color.copy(color);
    vase.material.roughness = 0.8; // Większa szorstkość dla efektu matowego
    vase.material.metalness = 0.0; // Brak metaliczności
    vase.material.envMapIntensity = 0.2; // Delikatne odbicia środowiska
  }

  // Aplikuj podobny, ale nieco ciemniejszy kolor do postumentu
  const pedestalColor = new THREE.Color().setHSL(
    hue,
    saturation * 0.8,
    lightness * 0.85
  );

  pedestal.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.copy(pedestalColor);
        child.material.roughness = 0.9;
        child.material.metalness = 0.0;
        child.material.envMapIntensity = 0.1;
      }
    }
  });

  return color.getHex();
};
// --- End Function Definition ---

export const useVaseManager = ({
  sceneRef,
  cameraRef,
  isPointerLocked,
  initialBrokenVases = 0,
  onVasesCreated,
}: VaseManagerProps): VaseManagerResult => {
  const brokenVasesCountRef = useRef<number>(initialBrokenVases);
  const vasesRef = useRef<THREE.Mesh[]>([]);
  const brokenVasesSetRef = useRef<Set<THREE.Mesh>>(new Set());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pedestalsRef = useRef<THREE.Group[]>([]);
  const hitboxesRef = useRef<THREE.Mesh[]>([]); // Ref for invisible hitboxes

  // Callback to notify about a broken vase (for shard creation)
  const onVaseBrokenRef = useRef<(info: BrokenVaseInfo) => void>(() => {});

  // --- Define Hitbox Geometry & Material ---
  // Adjust radius for desired hitbox size (e.g., 1.5x vase radius if known, or a fixed value)
  const hitboxRadius = 0.5; // Example radius, adjust as needed
  const hitboxGeometry = new THREE.SphereGeometry(hitboxRadius, 8, 8); // Simple sphere
  const hitboxMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    // visible: false, // Alternatively, use visible: false
    depthWrite: false, // Important for transparency potentially
  });
  // ----------------------------------------

  // Initialize pedestals and vases
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const gradientMap =
      (scene.userData.toonGradientTexture as THREE.Texture) || null;

    // Clear previous objects managed by this hook
    pedestalsRef.current.forEach((p) => scene.remove(p));
    hitboxesRef.current.forEach((h) => scene.remove(h));
    pedestalsRef.current = [];
    vasesRef.current = [];
    hitboxesRef.current = [];
    brokenVasesSetRef.current.clear();

    const newVases: THREE.Mesh[] = [];
    const newPedestals: THREE.Group[] = [];
    const newHitboxes: THREE.Mesh[] = [];

    for (let i = -5; i <= 5; i += 2.5) {
      const leftPedestal = createPedestal(-5, i * 2, gradientMap);
      const rightPedestal = createPedestal(5, i * 2, gradientMap);

      scene.add(leftPedestal);
      scene.add(rightPedestal);
      newPedestals.push(leftPedestal, rightPedestal);

      // Create vases
      const leftVase = createVaseOnPedestal(leftPedestal, gradientMap);
      const rightVase = createVaseOnPedestal(rightPedestal, gradientMap);

      // --- Create and link Hitboxes ---
      const createAndLinkHitbox = (
        vase: THREE.Mesh | null
      ): THREE.Mesh | null => {
        if (!vase) return null;
        const hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial.clone()); // Clone material
        // Position hitbox at the vase's initial position (levitation is visual only)
        const initialPosition = new THREE.Vector3();
        vase.getWorldPosition(initialPosition);
        hitbox.position.copy(initialPosition);
        hitbox.userData.targetVase = vase; // Link hitbox to vase
        scene.add(hitbox);
        newHitboxes.push(hitbox);
        return hitbox;
      };
      createAndLinkHitbox(leftVase);
      createAndLinkHitbox(rightVase);
      // -------------------------------

      // Apply pastel colors and store data (including initialY for levitation)
      let leftPedestalColor = 0xffffff;
      let rightPedestalColor = 0xffffff;
      if (leftVase) {
        leftPedestalColor = applyPastelToPedestal(leftPedestal, leftVase);
        leftVase.userData.pedestalColor = leftPedestalColor;
        leftVase.userData.initialY = leftVase.position.y; // Store initial Y relative to pedestal
        leftVase.userData.phaseOffset = Math.random() * Math.PI * 2;
      }
      if (rightVase) {
        rightPedestalColor = applyPastelToPedestal(rightPedestal, rightVase);
        rightVase.userData.pedestalColor = rightPedestalColor;
        rightVase.userData.initialY = rightVase.position.y; // Store initial Y relative to pedestal
        rightVase.userData.phaseOffset = Math.random() * Math.PI * 2;
      }

      // Add vases to the list ONLY if they were created
      if (leftVase) newVases.push(leftVase);
      if (rightVase) newVases.push(rightVase);
    }
    vasesRef.current = newVases;
    pedestalsRef.current = newPedestals;
    hitboxesRef.current = newHitboxes;

    // Wywołujemy callback po utworzeniu waz
    if (onVasesCreated) {
      onVasesCreated();
    }

    // Cleanup function for this effect
    return () => {
      const currentScene = sceneRef.current;
      if (currentScene) {
        pedestalsRef.current.forEach((p) => currentScene.remove(p));
        hitboxesRef.current.forEach((h) => currentScene.remove(h)); // Remove hitboxes too
      }
      // Clear refs
      pedestalsRef.current = [];
      vasesRef.current = [];
      hitboxesRef.current = [];
      brokenVasesSetRef.current.clear();
      // Dispose hitbox geometry/material if needed (usually not necessary unless many unique ones)
      // hitboxGeometry.dispose();
      // hitboxMaterial.dispose();
    };
  }, [sceneRef, onVasesCreated]);

  // Function to handle vase breaking logic
  const handleVaseClick = useCallback(
    (coordsNDC?: THREE.Vector2) => {
      if (!cameraRef.current || !sceneRef.current) return;

      const raycastCoords = coordsNDC || new THREE.Vector2();
      raycasterRef.current.setFromCamera(raycastCoords, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(
        hitboxesRef.current,
        false
      );

      if (intersects.length > 0) {
        const intersectedHitbox = intersects[0].object as THREE.Mesh;
        const targetVase = intersectedHitbox.userData.targetVase as THREE.Mesh;

        if (targetVase && !brokenVasesSetRef.current.has(targetVase)) {
          brokenVasesSetRef.current.add(targetVase);
          brokenVasesCountRef.current += 1;

          const worldPosition = new THREE.Vector3();
          targetVase.getWorldPosition(worldPosition);

          const pedestalColorHex =
            targetVase.userData.pedestalColor || 0xffffff;
          const shardColor = new THREE.Color(pedestalColorHex);

          // Dispose visible vase resources
          if (targetVase.material && !Array.isArray(targetVase.material)) {
            const baseMaterial =
              targetVase.material as THREE.MeshStandardMaterial;
            if (baseMaterial.map) baseMaterial.map.dispose();
            baseMaterial.dispose();
            if (targetVase.geometry) targetVase.geometry.dispose();
          }

          // Remove visible vase and its hitbox
          targetVase.removeFromParent();
          intersectedHitbox.removeFromParent();

          // Update refs
          vasesRef.current = vasesRef.current.filter((v) => v !== targetVase);
          hitboxesRef.current = hitboxesRef.current.filter(
            (h) => h !== intersectedHitbox
          );

          playBreakSound();

          onVaseBrokenRef.current({
            position: worldPosition,
            shardColor: shardColor,
          });
        }
      }
    },
    [cameraRef, sceneRef]
  );

  return {
    brokenVasesCount: brokenVasesCountRef.current,
    handleVaseClick,
    // Function allowing external systems (like shard manager) to subscribe to vase break events
    setOnVaseBrokenCallback: (callback: (info: BrokenVaseInfo) => void) => {
      onVaseBrokenRef.current = callback;
    },
    vasesRef,
    pedestalsRef,
    onVasesCreated,
  };
};
