import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";

interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  canJump: boolean;
}

const GreekVases = () => {
  // Podstawowe stany
  const mountRef = useRef<HTMLDivElement>(null);
  const [brokenVases, setBrokenVases] = useState(0);
  const [cameraHeight] = useState(2.5);
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  // Referencje do komponentów sceny
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const playerStateRef = useRef<PlayerState | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Wymiary sceny
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // Zmienne przechowujące obiekty
    const vases: THREE.Mesh[] = [];
    const shards: THREE.Mesh[] = [];
    const pedestalPositions: { x: number; z: number }[] = [];
    const brokenVasesSet = new Set<THREE.Mesh>();

    // Scena i kamera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 1000);
    camera.position.set(0, cameraHeight, -15);

    cameraRef.current = camera;
    sceneRef.current = scene;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Światła
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;

    // Cienie
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

    // Podłoga
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

    // Ściany
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

    // Funkcje związane z wazami
    function createVaseTexture(type: number): THREE.CanvasTexture {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return new THREE.CanvasTexture(canvas);

      canvas.width = 512;
      canvas.height = 512;

      const bgColor =
        type === 1 ? "#e8b27d" : type === 2 ? "#d6a671" : "#bf8c5a";
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

      return new THREE.CanvasTexture(canvas);
    }

    function createVaseGeometry(type: number): THREE.CylinderGeometry {
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

    const vaseNames: { [key: number]: string } = {
      1: "Amfora",
      2: "Krater",
      3: "Hydria",
    };

    // Funkcja dźwięku
    function playBreakSound() {
      try {
        const AudioContext =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const numSounds = 5 + Math.floor(Math.random() * 3);

        for (let i = 0; i < numSounds; i++) {
          setTimeout(() => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            const frequency = 300 + Math.random() * 600;
            oscillator.type = "triangle";
            oscillator.frequency.setValueAtTime(
              frequency,
              audioCtx.currentTime
            );

            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(
              0.001,
              audioCtx.currentTime + 0.2
            );

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
          }, i * 30);
        }
      } catch (e) {
        console.log("Dźwięk nie może zostać odtworzony:", e);
      }
    }

    // Tworzenie postumentów
    function createPedestal(x: number, z: number): THREE.Group {
      const group = new THREE.Group();

      const positionHash = Math.abs(x * 1000 + z * 10);
      const heightType = positionHash % 3;
      let columnHeight = 0.9; // Domyślna wysokość
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

      // Podstawa kolumny
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

      // Trzon kolumny
      const columnGeometry = new THREE.CylinderGeometry(
        0.4,
        0.4,
        columnHeight,
        24,
        1
      );

      const columnCanvas = document.createElement("canvas");
      const columnCtx = columnCanvas.getContext("2d");
      if (!columnCtx) return group;

      columnCanvas.width = 512;
      columnCanvas.height = 512;

      columnCtx.fillStyle = "#f0f0f0";
      columnCtx.fillRect(0, 0, columnCanvas.width, columnCanvas.height);

      const flutesCount = 20;
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

      // Kapitel
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
      pedestalPositions.push({ x, z });

      return group;
    }

    // Obsługa zdarzeń
    function handleResize() {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current)
        return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
    }

    // Obsługa ruchu gracza
    function updatePlayerPosition() {
      if (!playerStateRef.current || !cameraRef.current) return;

      const player = playerStateRef.current;
      const velocity = player.velocity;
      const direction = new THREE.Vector3();

      direction.z = Number(player.moveForward) - Number(player.moveBackward);
      direction.x = Number(player.moveLeft) - Number(player.moveRight);
      direction.normalize();

      if (direction.z !== 0) {
        velocity.z = direction.z * 0.1;
      } else {
        velocity.z = 0;
      }

      if (direction.x !== 0) {
        velocity.x = direction.x * 0.1;
      } else {
        velocity.x = 0;
      }

      // Aktualizacja pozycji kamery
      cameraRef.current.position.x += velocity.x;
      cameraRef.current.position.z += velocity.z;

      // Aktualizacja pozycji gracza
      player.position.copy(cameraRef.current.position);
    }

    // Obsługa klawiatury
    function handleKeyDown(event: KeyboardEvent) {
      if (!playerStateRef.current) return;

      switch (event.code) {
        case "KeyW":
          playerStateRef.current.moveForward = true;
          break;
        case "KeyS":
          playerStateRef.current.moveBackward = true;
          break;
        case "KeyA":
          playerStateRef.current.moveLeft = true;
          break;
        case "KeyD":
          playerStateRef.current.moveRight = true;
          break;
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!playerStateRef.current) return;

      switch (event.code) {
        case "KeyW":
          playerStateRef.current.moveForward = false;
          break;
        case "KeyS":
          playerStateRef.current.moveBackward = false;
          break;
        case "KeyA":
          playerStateRef.current.moveLeft = false;
          break;
        case "KeyD":
          playerStateRef.current.moveRight = false;
          break;
      }
    }

    // Obsługa myszy
    function handleMouseMove(event: MouseEvent) {
      if (!isPointerLocked || !cameraRef.current || !playerStateRef.current)
        return;

      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;

      playerStateRef.current.rotation.y -= movementX * 0.002;
      playerStateRef.current.rotation.x -= movementY * 0.002;

      // Ograniczenie rotacji w pionie
      playerStateRef.current.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, playerStateRef.current.rotation.x)
      );

      cameraRef.current.rotation.copy(playerStateRef.current.rotation);
    }

    function handleMouseClick() {
      if (!isPointerLocked) {
        mountRef.current?.requestPointerLock();
      } else if (cameraRef.current) {
        // Sprawdzenie czy trafiamy w wazę
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(), cameraRef.current);

        const intersects = raycaster.intersectObjects(vases, false);

        if (intersects.length > 0) {
          const intersectedObject = intersects[0].object;
          if (intersectedObject instanceof THREE.Mesh) {
            const vase = intersectedObject;

            // Sprawdzenie czy waza nie została już rozbita
            if (!brokenVasesSet.has(vase)) {
              brokenVasesSet.add(vase);
              setBrokenVases((prev) => prev + 1);

              // Pobranie globalnej pozycji wazy PRZED usunięciem
              const worldPosition = new THREE.Vector3();
              vase.getWorldPosition(worldPosition);

              // Pobranie materiału wazy do określenia koloru odłamków
              const baseMaterial = vase.material as THREE.MeshStandardMaterial;
              const baseColor = baseMaterial.color || new THREE.Color(0xe8b27d); // Domyślny kolor

              // Usunięcie wazy z postumentu
              const pedestal = vase.parent;
              if (pedestal) {
                pedestal.remove(vase);
              }

              // Utworzenie odłamków
              const numberOfShards = 12 + Math.floor(Math.random() * 8); // Więcej losowości w liczbie

              for (let i = 0; i < numberOfShards; i++) {
                let geometry;
                const shapeType = Math.floor(Math.random() * 4);
                const shardSize = 0.05 + Math.random() * 0.15; // Losowy rozmiar odłamka

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
                  roughness: 0.6 + Math.random() * 0.3, // Losowa chropowatość
                  metalness: 0.1 + Math.random() * 0.1, // Losowy metaliczność
                });

                const shard = new THREE.Mesh(geometry, material);

                // Ustawienie początkowej pozycji odłamka (w miejscu wazy)
                shard.position.copy(worldPosition);
                // Dodanie małego losowego przesunięcia, aby nie startowały z tego samego punktu
                shard.position.x += (Math.random() - 0.5) * 0.1;
                shard.position.y += (Math.random() - 0.5) * 0.1;
                shard.position.z += (Math.random() - 0.5) * 0.1;

                // Bardziej losowe prędkości dla odłamków
                const speedMagnitude = 0.05 + Math.random() * 0.1;
                const velocity = new THREE.Vector3(
                  (Math.random() - 0.5) * 2, // Losowy kierunek XZ
                  0.5 + Math.random() * 0.5, // Zawsze trochę w górę
                  (Math.random() - 0.5) * 2
                );
                velocity.normalize().multiplyScalar(speedMagnitude);

                shard.userData = {
                  velocity: velocity,
                  rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15, // Zwiększona losowość rotacji
                    (Math.random() - 0.5) * 0.15,
                    (Math.random() - 0.5) * 0.15
                  ),
                  onGround: false,
                };

                // Dodajemy odłamek do GŁÓWNEJ sceny
                scene.add(shard);
                shards.push(shard);
              }

              // Odtworzenie dźwięku
              playBreakSound();
            }
          }
        }
      }
    }

    // Obsługa Pointer Lock
    function handlePointerLockChange() {
      setIsPointerLocked(document.pointerLockElement === mountRef.current);
    }

    function handlePointerLockError() {
      console.error("Pointer Lock Error");
    }

    // Inicjalizacja prostego stanu gracza
    const playerState: PlayerState = {
      position: new THREE.Vector3(0, cameraHeight, -12),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      moveForward: false,
      moveBackward: false,
      moveLeft: false,
      moveRight: false,
      canJump: false,
    };

    playerStateRef.current = playerState;

    // Funkcja tworząca wazę na postumencie
    function createVaseOnPedestal(pedestal: THREE.Group, x: number, z: number) {
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
      vase.position.set(0, 1.8, 0); // Podnosimy wazę wyżej
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
      vases.push(vase);
    }

    // Tworzenie waz na postumentach
    for (let i = -5; i <= 5; i += 2.5) {
      const leftPedestal = createPedestal(-5, i * 2);
      const rightPedestal = createPedestal(5, i * 2);

      scene.add(leftPedestal);
      scene.add(rightPedestal);

      createVaseOnPedestal(leftPedestal, -5, i * 2);
      createVaseOnPedestal(rightPedestal, 5, i * 2);
    }

    // Funkcje pomocnicze dla odłamków
    function updateShards() {
      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        const userData = shard.userData;

        if (!userData.onGround) {
          // Aktualizacja pozycji
          shard.position.x += userData.velocity.x;
          shard.position.y += userData.velocity.y;
          shard.position.z += userData.velocity.z;

          // Aktualizacja rotacji
          shard.rotation.x += userData.rotationSpeed.x;
          shard.rotation.y += userData.rotationSpeed.y;
          shard.rotation.z += userData.rotationSpeed.z;

          // Grawitacja
          userData.velocity.y -= 0.01;

          // Sprawdzenie kolizji z podłogą
          if (shard.position.y < 0.1) {
            shard.position.y = 0.1;
            userData.velocity.y = -userData.velocity.y * 0.3; // Odbicie
            userData.velocity.x *= 0.8; // Tarcie
            userData.velocity.z *= 0.8; // Tarcie

            // Jeśli prędkość jest bardzo mała, zatrzymaj odłamek
            if (
              Math.abs(userData.velocity.y) < 0.01 &&
              Math.abs(userData.velocity.x) < 0.01 &&
              Math.abs(userData.velocity.z) < 0.01
            ) {
              userData.onGround = true;
            }
          }
        }
      }
    }

    function animate() {
      const animationId = requestAnimationFrame(animate);

      if (isPointerLocked) {
        updatePlayerPosition();
      }

      updateShards();
      renderer.render(scene, camera);

      return animationId;
    }

    // Rozpoczęcie animacji
    const animationId = animate();

    // Nasłuchiwanie zdarzeń
    window.addEventListener("resize", handleResize);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleMouseClick);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    // Czyszczenie
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleMouseClick);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("pointerlockerror", handlePointerLockError);

      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }

      // Zatrzymanie animacji
      cancelAnimationFrame(animationId);
    };
  }, [isPointerLocked]);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#000",
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
      >
        Zniszczone wazy: {brokenVases}
      </div>
      <div className="controls-info">
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
      />
    </div>
  );
};

export default GreekVases;
