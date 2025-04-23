import { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

interface SceneSetupProps {
  mountRef: React.RefObject<HTMLDivElement>;
  cameraHeight: number;
  isLightMode: boolean;
}

// Define the return type of the hook
interface SceneSetupResult {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  composerRef: React.RefObject<EffectComposer | null>;
  setOutlineObjects: (objects: THREE.Object3D[]) => void;
}

// Helper functions for environment setup (internal to the hook)
const setupLights = (scene: THREE.Scene) => {
  // Główne światło kierunkowe (z okna)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.position.set(5, 8, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -15;
  directionalLight.shadow.camera.right = 15;
  directionalLight.shadow.camera.top = 15;
  directionalLight.shadow.camera.bottom = -15;
  directionalLight.shadow.radius = 4; // Miększe cienie
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  return [directionalLight];
};

// Reintroduce setupFloor function with PlaneGeometry
const setupFloor = (scene: THREE.Scene) => {
  const floorGeometry = new THREE.PlaneGeometry(50, 50); // Large plane
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffefc9, // Light peach pastel color
    // color: 0x302b22, // Very dark brown color
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide, // Render both sides just in case
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal
  floor.position.y = 0; // Position at ground level
  floor.receiveShadow = true;
  scene.add(floor);
  // console.log(
  //   "Floor parent UUID:",
  //   floor.parent?.uuid,
  //   "Scene UUID:",
  //   scene.uuid
  // ); // Log parent UUID
  return floor;
};

export const useSceneSetup = ({
  mountRef,
  cameraHeight,
  isLightMode,
}: SceneSetupProps): SceneSetupResult => {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  const fxaaPassRef = useRef<ShaderPass | null>(null);

  // State to trigger updates when refs are ready
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;
    const width = currentMount.clientWidth;
    const height = currentMount.clientHeight;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLightMode ? 0.9 : 0.5;
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene setup
    const scene = new THREE.Scene();
    const environment = new RoomEnvironment();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(
      environment,
      isLightMode ? 0.03 : 0.01
    ).texture;
    scene.environment = envTexture;
    scene.background = new THREE.Color(isLightMode ? 0x2a4b7c : 0x000000);
    environment.dispose();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(0, cameraHeight, 10);
    cameraRef.current = camera;

    // Setup environment elements
    const lights = setupLights(scene);
    const floor = setupFloor(scene);

    // Lights - Złagodzone oświetlenie dla miękkiego efektu
    const ambientLight = new THREE.AmbientLight(
      isLightMode ? 0xffffff : 0x202020,
      isLightMode ? 0.35 : 0.1
    );
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(
      isLightMode ? 0xffffff : 0x202020,
      isLightMode ? 0xd8e8ff : 0x000000,
      isLightMode ? 0.25 : 0.05
    );
    scene.add(hemisphereLight);

    // OrbitControls for debugging/alternative view
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;
    controls.enabled = false;

    // --- Post-processing ---
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Outline pass setup
    const outlinePass = new OutlinePass(
      new THREE.Vector2(width, height),
      scene,
      camera
    );
    outlinePass.edgeStrength = 1.5; // Subtelna siła
    outlinePass.edgeGlow = 0;
    outlinePass.edgeThickness = 1.0; // Cienki obrys
    outlinePass.pulsePeriod = 0;
    outlinePass.visibleEdgeColor.set("#000000");
    outlinePass.hiddenEdgeColor.set("#000000");
    outlinePass.overlayMaterial.blending = THREE.NormalBlending;
    outlinePass.downSampleRatio = 1;
    outlinePass.clear = true;

    // Set outlines for all meshes
    const setOutlineForAllObjects = () => {
      const objectsToOutline: THREE.Object3D[] = [];
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          !(object.material instanceof THREE.ShadowMaterial) &&
          !(object.material instanceof THREE.LineBasicMaterial)
        ) {
          objectsToOutline.push(object);

          // Sprawdź czy obiekt ma dzieci (np. linie krawędzi)
          object.children.forEach((child) => {
            if (child instanceof THREE.LineSegments) {
              child.layers.enable(1);
            }
          });
        }
      });
      outlinePass.selectedObjects = objectsToOutline;
    };

    // Zamiast eventListenera, użyjmy MutationObserver na rendererze
    const observer = new MutationObserver(() => {
      setOutlineForAllObjects();
    });

    observer.observe(renderer.domElement.parentElement!, {
      childList: true,
      subtree: true,
    });

    setOutlineForAllObjects();
    outlinePassRef.current = outlinePass;
    composer.addPass(outlinePass);

    // Add FXAA Pass for anti-aliasing
    const fxaaPass = new ShaderPass(FXAAShader);
    const pixelRatio = renderer.getPixelRatio();
    fxaaPass.material.uniforms["resolution"].value.x = 1 / (width * pixelRatio);
    fxaaPass.material.uniforms["resolution"].value.y =
      1 / (height * pixelRatio);
    fxaaPassRef.current = fxaaPass;
    composer.addPass(fxaaPass);

    // Adjust renderer settings for better cartoon look - REVERTED
    // renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    setIsInitialized(true); // Mark as initialized

    // Basic resize handling within the setup hook
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !currentMount) return;

      const newWidth = currentMount.clientWidth;
      const newHeight = currentMount.clientHeight;

      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
      // Check if composer exists before resizing
      if (composerRef.current) {
        composerRef.current.setSize(newWidth, newHeight); // Resize composer
      }
      // Check if outline pass exists before resizing
      if (outlinePassRef.current) {
        outlinePassRef.current.resolution.set(newWidth, newHeight); // Resize outline pass
      }
      // Resize FXAA pass
      if (fxaaPassRef.current) {
        const pixelRatio = rendererRef.current.getPixelRatio();
        fxaaPassRef.current.material.uniforms["resolution"].value.x =
          1 / (newWidth * pixelRatio);
        fxaaPassRef.current.material.uniforms["resolution"].value.y =
          1 / (newHeight * pixelRatio);
      }
    };

    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);

      // Cleanup environment elements
      lights.forEach((light) => scene.remove(light));
      if (floor) {
        scene.remove(floor);
        floor.geometry.dispose();
        if (Array.isArray(floor.material)) {
          floor.material.forEach((m) => m.dispose());
        } else {
          floor.material.dispose();
        }
      }

      // Cleanup environment map and generator
      if (envTexture) {
        envTexture.dispose();
      }
      if (pmremGenerator) {
        pmremGenerator.dispose();
      }

      // Cleanup renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
      }

      // Nullify refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
      fxaaPassRef.current = null;
    };
  }, [mountRef, cameraHeight, isLightMode]);

  // Function to set objects for outlining
  const setOutlineObjects = useCallback((objects: THREE.Object3D[]) => {
    if (outlinePassRef.current) {
      outlinePassRef.current.selectedObjects = objects;
      console.log("Outline objects set:", objects.length);
    }
  }, []); // No dependencies needed as it uses refs

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    setOutlineObjects,
  };
};
