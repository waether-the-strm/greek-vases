import * as THREE from "three";

// Vase Name Mapping
export const vaseNames: { [key: number]: string } = {
  1: "Amfora",
  2: "Krater",
  3: "Hydria",
};

// Function to create vase texture
export function createVaseTexture(type: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  canvas.width = 512;
  canvas.height = 512;

  const bgColor = type === 1 ? "#e8b27d" : type === 2 ? "#d6a671" : "#bf8c5a";
  const patternColor = type === 3 ? "#000000" : "#422";

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = patternColor;

  if (type === 1 || type === 2) {
    const size = 20;
    const rows = canvas.height / size;

    for (let y = 0; y < rows; y++) {
      if (y % 5 === 0) {
        for (let x = 0; x < canvas.width; x += size * 4) {
          ctx.fillRect(x, y * size, size * 3, size);
          ctx.fillRect(x + size * 3, y * size, size, size * 3);
          ctx.fillRect(x + size, y * size + size * 2, size * 3, size);
          ctx.fillRect(x, y * size + size * 2, size, size);
        }
      }
    }
  } else {
    ctx.fillRect(
      canvas.width / 4,
      canvas.height / 4,
      canvas.width / 2,
      canvas.height / 2
    );
    ctx.clearRect(
      canvas.width / 3,
      canvas.height / 3,
      canvas.width / 6,
      canvas.height / 3
    );
  }

  ctx.fillRect(0, 0, canvas.width, canvas.height / 10);
  ctx.fillRect(
    0,
    canvas.height - canvas.height / 10,
    canvas.width,
    canvas.height / 10
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true; // Ensure texture updates
  return texture;
}

// Function to create vase geometry
export function createVaseGeometry(type: number): THREE.CylinderGeometry {
  switch (type) {
    case 1: // Amfora
      return new THREE.CylinderGeometry(0.4, 0.3, 1.2, 16, 1);
    case 2: // Krater
      return new THREE.CylinderGeometry(0.5, 0.25, 1.0, 16, 1);
    case 3: // Hydria
      return new THREE.CylinderGeometry(0.35, 0.4, 0.9, 16, 1);
    default:
      return new THREE.CylinderGeometry(0.4, 0.3, 1.2, 16, 1);
  }
}

// Function to play break sound
export function playBreakSound() {
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.warn("AudioContext not supported.");
      return;
    }

    const audioCtx = new AudioContext();
    const numSounds = 5 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numSounds; i++) {
      setTimeout(() => {
        if (audioCtx.state === "closed") return; // Avoid errors if context closed
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        const frequency = 300 + Math.random() * 600;
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioCtx.currentTime + 0.2
        );

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);

        // Close context after sounds are done playing to release resources
        if (i === numSounds - 1) {
          setTimeout(() => {
            if (audioCtx.state !== "closed") {
              audioCtx
                .close()
                .catch((e) => console.error("Error closing audio context", e));
            }
          }, 300); // Delay closing slightly after last sound stops
        }
      }, i * 30);
    }
  } catch (e) {
    console.error("Could not play break sound:", e);
  }
}

// Function to create pedestal
export function createPedestal(
  x: number,
  z: number,
  gradientMap: THREE.Texture | null
): THREE.Group {
  const group = new THREE.Group();

  const positionHash = Math.abs(x * 1000 + z * 10);
  const heightType = positionHash % 3;
  let columnHeight = 0.9; // Default height
  let baseHeight = 0.2;
  let capHeight = 0.2;

  switch (heightType) {
    case 0:
      columnHeight = 0.9;
      break;
    case 1:
      columnHeight = 1.2;
      break;
    case 2:
      columnHeight = 1.5;
      break;
  }

  // Column Base
  const baseGeometry = new THREE.CylinderGeometry(0.7, 0.8, baseHeight, 24);
  const baseMaterial = gradientMap
    ? new THREE.MeshToonMaterial({
        color: 0xbababa, // Ciemniejszy szary dla bazy
        gradientMap: gradientMap,
      })
    : new THREE.MeshStandardMaterial({ color: 0xbababa, roughness: 0.8 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Column Shaft
  const columnGeometry = new THREE.CylinderGeometry(
    0.4,
    0.5,
    columnHeight,
    24,
    1
  );

  // Column Texture (Fluting) - Simplified for Toon Material
  // We might not need the complex texture if Toon shading provides enough detail
  // For now, keep a simple color
  const columnMaterial = gradientMap
    ? new THREE.MeshToonMaterial({
        color: 0xe0e0e0, // Jasnoszary dla trzonu
        gradientMap: gradientMap,
      })
    : new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5 });

  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.y = baseHeight + columnHeight / 2;
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);

  // Capital
  const capGeometry = new THREE.CylinderGeometry(0.5, 0.4, capHeight, 24);
  const capMaterial = gradientMap
    ? new THREE.MeshToonMaterial({
        color: 0xbababa, // Ciemniejszy szary dla kapitelu
        gradientMap: gradientMap,
      })
    : new THREE.MeshStandardMaterial({ color: 0xbababa, roughness: 0.8 });
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = baseHeight + columnHeight + capHeight / 2;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  group.position.set(x, 0, z);

  return group;
}

// Function to create a vase and add it to a pedestal
// Note: `vases` array modification is removed, it should be managed by the caller hook
export function createVaseOnPedestal(
  pedestal: THREE.Group,
  gradientMap: THREE.Texture | null
): THREE.Mesh {
  const type = Math.ceil(Math.random() * 3);
  const geometry = createVaseGeometry(type);
  const texture = createVaseTexture(type);

  const material = gradientMap
    ? new THREE.MeshToonMaterial({
        map: texture,
        gradientMap: gradientMap,
      })
    : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });

  const vase = new THREE.Mesh(geometry, material);

  // Calculate pedestal height dynamically
  let pedestalHeight = 0;
  pedestal.children.forEach((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.CylinderGeometry
    ) {
      pedestalHeight = Math.max(
        pedestalHeight,
        child.position.y + child.geometry.parameters.height / 2
      );
    }
  });

  vase.position.set(
    0,
    pedestalHeight + (geometry.parameters.height / 2) * 0.9,
    0
  ); // Position vase on top
  vase.scale.set(0.9, 0.9, 0.9);

  // Use the type to set the name for easier identification
  vase.name = vaseNames[type] || "Vase";
  vase.castShadow = true;
  vase.receiveShadow = true;

  // User data for state management (e.g., if it's broken)
  vase.userData = {
    isBroken: false,
    type: type,
    originalPosition: vase.position.clone(),
    originalRotation: vase.rotation.clone(),
    shardColor: material.color || new THREE.Color(0xffffff), // Store color for shards
  };

  pedestal.add(vase); // Add vase directly to the pedestal group

  return vase;
}
