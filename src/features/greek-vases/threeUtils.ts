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
export function createPedestal(x: number, z: number): THREE.Group {
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
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.2,
  });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = baseHeight / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Column Shaft
  const columnGeometry = new THREE.CylinderGeometry(
    0.4,
    0.4,
    columnHeight,
    24,
    1
  );

  // Column Texture (Fluting)
  const columnCanvas = document.createElement("canvas");
  const columnCtx = columnCanvas.getContext("2d");
  if (!columnCtx) return group; // Return group if context fails

  columnCanvas.width = 64; // Smaller texture for performance
  columnCanvas.height = 512;

  columnCtx.fillStyle = "#f0f0f0";
  columnCtx.fillRect(0, 0, columnCanvas.width, columnCanvas.height);

  const flutesCount = 10; // Fewer flutes for smaller texture
  const fluteWidth = columnCanvas.width / flutesCount;

  for (let i = 0; i < flutesCount; i++) {
    const gradient = columnCtx.createLinearGradient(
      i * fluteWidth,
      0,
      (i + 0.5) * fluteWidth,
      0
    );

    gradient.addColorStop(0, "#e0e0e0");
    gradient.addColorStop(0.5, "#b0b0b0");
    gradient.addColorStop(1, "#e0e0e0");

    columnCtx.fillStyle = gradient;
    columnCtx.fillRect(i * fluteWidth, 0, fluteWidth, columnCanvas.height);
  }

  const columnTexture = new THREE.CanvasTexture(columnCanvas);
  columnTexture.wrapS = THREE.RepeatWrapping;
  columnTexture.wrapT = THREE.RepeatWrapping;
  columnTexture.repeat.set(4, 1); // Repeat texture horizontally
  columnTexture.needsUpdate = true;

  const columnMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f8f8,
    roughness: 0.1,
    map: columnTexture,
  });

  const column = new THREE.Mesh(columnGeometry, columnMaterial);
  column.position.y = baseHeight + columnHeight / 2;
  column.castShadow = true;
  column.receiveShadow = true;
  group.add(column);

  // Capital
  const capGeometry = new THREE.CylinderGeometry(0.5, 0.4, capHeight, 24);
  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.2,
  });
  const cap = new THREE.Mesh(capGeometry, capMaterial);
  cap.position.y = baseHeight + columnHeight + capHeight / 2;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  group.position.set(x, 0, z);
  // Removed pedestalPositions.push({ x, z }); - This state should be managed elsewhere

  return group;
}

// Function to create a vase and add it to a pedestal
// Note: `vases` array modification is removed, it should be managed by the caller hook
export function createVaseOnPedestal(
  pedestal: THREE.Group,
  x: number,
  z: number
): THREE.Mesh {
  const positionHashForType = Math.abs(x * 500 + z * 50);
  const vaseType = (positionHashForType % 3) + 1;
  const sizeScale = 0.8 + (positionHashForType % 100) / 250;

  const vaseGeometry = createVaseGeometry(vaseType);
  const vaseTexture = createVaseTexture(vaseType);
  const vaseMaterial = new THREE.MeshStandardMaterial({
    map: vaseTexture,
    roughness: 0.7,
    metalness: 0.05,
  });

  const vase = new THREE.Mesh(vaseGeometry, vaseMaterial);
  // Calculate vase position based on pedestal height
  let pedestalHeight = 0; // Calculate actual height from pedestal children if needed
  pedestal.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(child);
      pedestalHeight = Math.max(pedestalHeight, box.max.y);
    }
  });
  vase.position.set(
    0,
    pedestalHeight + (vaseGeometry.parameters.height * sizeScale) / 2,
    0
  ); // Position on top

  vase.scale.set(sizeScale, sizeScale, sizeScale);
  vase.castShadow = true;
  vase.receiveShadow = true;

  vase.userData = {
    type: vaseType,
    name: vaseNames[vaseType],
    size: sizeScale,
    pedestal: { x, z },
    broken: false,
  };

  pedestal.add(vase);
  // Removed vases.push(vase); - This state should be managed elsewhere
  return vase;
}
