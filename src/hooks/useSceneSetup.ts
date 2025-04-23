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
}

// Define the return type of the hook
interface SceneSetupResult {
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  composerRef: React.RefObject<EffectComposer | null>;
  setOutlineObjects: (objects: THREE.Object3D[]) => void;
  initializationStatus: "pending" | "ready";
  // Refs for debug panel
  outlinePassRef: React.RefObject<OutlinePass | null>;
  fxaaPassRef: React.RefObject<ShaderPass | null>;
  ambientLightRef: React.RefObject<THREE.AmbientLight | null>;
  hemisphereLightRef: React.RefObject<THREE.HemisphereLight | null>;
  mainDirectionalLightRef: React.RefObject<THREE.DirectionalLight | null>;
}

// Helper functions for environment setup (internal to the hook)
const setupLights = (scene: THREE.Scene) => {
  // Główne światło kierunkowe (z okna)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
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
  directionalLight.shadow.radius = 8;
  directionalLight.shadow.bias = -0.0005;
  scene.add(directionalLight);

  // Keep track of lights for cleanup (optional, good practice)
  const lightsArray: THREE.Light[] = [directionalLight];

  // Create other lights but return them individually for refs
  const ambientLight = new THREE.AmbientLight(0xffefd5, 0.3);
  scene.add(ambientLight);
  lightsArray.push(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xfff0e6, 0xffe4e1, 0.2);
  scene.add(hemisphereLight);
  lightsArray.push(hemisphereLight);

  return {
    directionalLight,
    ambientLight,
    hemisphereLight,
    lightsArray, // For easy cleanup
  };
};

// Reintroduce setupFloor function with PlaneGeometry
const setupFloor = (scene: THREE.Scene) => {
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff5e6,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.userData.noOutline = true;
  scene.add(floor);
  return floor;
};

// Add this at the top of the file after imports
const withoutTransition = (action: () => void) => {
  const style = document.createElement("style");
  const css = document.createTextNode(`* {
     -webkit-transition: none !important;
     -moz-transition: none !important;
     -o-transition: none !important;
     -ms-transition: none !important;
     transition: none !important;
  }`);
  style.appendChild(css);

  document.head.appendChild(style);
  window.getComputedStyle(style).opacity;
  action();
  document.head.removeChild(style);
};

export const useSceneSetup = ({
  mountRef,
  cameraHeight,
}: SceneSetupProps): SceneSetupResult => {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  const fxaaPassRef = useRef<ShaderPass | null>(null);
  // Add refs for lights
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight | null>(null);
  const mainDirectionalLightRef = useRef<THREE.DirectionalLight | null>(null);

  const controlsRef = useRef<OrbitControls | null>(null);
  const isInitializedRef = useRef(false);
  const cleanupFuncRef = useRef<(() => void) | null>(null);
  const [initializationStatus, setInitializationStatus] = useState<
    "pending" | "ready"
  >("pending");

  const setOutlineObjects = useCallback((objects: THREE.Object3D[]) => {
    console.log(
      "[setOutlineObjects] Received objects:",
      objects.map((o) => `${o.name || o.type} (ID: ${o.uuid.substring(0, 6)})`)
    );
    if (outlinePassRef.current) {
      const filteredObjects = objects.filter((obj) => {
        const isVase =
          obj.name === "Amfora" ||
          obj.name === "Krater" ||
          obj.name === "Hydria";
        const isPedestal =
          obj instanceof THREE.Group &&
          obj.children.some(
            (child) =>
              child instanceof THREE.Mesh &&
              child.geometry instanceof THREE.CylinderGeometry
          );
        const hasNoOutline = obj.userData.noOutline === true;
        const shouldOutline = (isVase || isPedestal) && !hasNoOutline;
        return shouldOutline;
      });

      console.log(
        "[setOutlineObjects] Filtered objects to outline:",
        filteredObjects.map(
          (o) => `${o.name || o.type} (ID: ${o.uuid.substring(0, 6)})`
        )
      );

      outlinePassRef.current.selectedObjects = filteredObjects;
      outlinePassRef.current.edgeStrength = 5.0;
      outlinePassRef.current.edgeGlow = 1.0;
      outlinePassRef.current.edgeThickness = 2.0;
      outlinePassRef.current.pulsePeriod = 0;
      outlinePassRef.current.visibleEdgeColor.set(0x333333);
      outlinePassRef.current.hiddenEdgeColor.set(0x333333);
      console.log("[setOutlineObjects] OutlinePass updated.");
    } else {
      console.warn("[setOutlineObjects] outlinePassRef.current is null!");
    }
  }, []);

  useEffect(() => {
    if (!mountRef.current) {
      console.log("useEffect skipped: mountRef is null");
      return;
    }
    console.log("useEffect running for useSceneSetup");
    setInitializationStatus("pending");
    isInitializedRef.current = false;

    const currentMount = mountRef.current;
    let resizeObserver: ResizeObserver | null = null;

    const setup = (width: number, height: number): (() => void) => {
      if (isInitializedRef.current) {
        console.log("Initialization already done, skipping setup.");
        return () => {};
      }
      console.log(`Initializing scene with dimensions: ${width}x${height}`);

      // --- Start of Setup Logic ---
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe6f3ff);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(0, cameraHeight, 10);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        stencil: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.2;
      if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
      } else {
        console.error(
          "Mount point disappeared before appending renderer DOM element."
        );
        renderer.dispose();
        return () => {};
      }
      rendererRef.current = renderer;

      const environment = new RoomEnvironment();
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTexture = pmremGenerator.fromScene(environment, 0.02).texture;
      scene.environment = envTexture;
      environment.dispose();

      // Setup lights and assign to refs
      const { directionalLight, ambientLight, hemisphereLight, lightsArray } =
        setupLights(scene);
      mainDirectionalLightRef.current = directionalLight;
      ambientLightRef.current = ambientLight;
      hemisphereLightRef.current = hemisphereLight;

      const floor = setupFloor(scene);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.screenSpacePanning = false;
      controls.maxPolarAngle = Math.PI / 2;
      controls.enabled = false;
      controlsRef.current = controls;

      const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        samples: 4,
        colorSpace: THREE.SRGBColorSpace,
        depthBuffer: true,
        stencilBuffer: true,
      });

      const composer = new EffectComposer(renderer, renderTarget);
      composerRef.current = composer;
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const outlinePass = new OutlinePass(
        new THREE.Vector2(width, height),
        scene,
        camera
      );
      outlinePass.selectedObjects = [];
      outlinePass.edgeStrength = 5.0;
      outlinePass.edgeGlow = 1.0;
      outlinePass.edgeThickness = 2.0;
      outlinePass.pulsePeriod = 0;
      outlinePass.visibleEdgeColor.set(0x000000);
      outlinePass.hiddenEdgeColor.set(0x000000);
      outlinePassRef.current = outlinePass;
      composer.addPass(outlinePass);

      const fxaaPass = new ShaderPass(FXAAShader);
      const pixelRatio = renderer.getPixelRatio();
      fxaaPass.material.uniforms["resolution"].value.x =
        1 / (width * pixelRatio);
      fxaaPass.material.uniforms["resolution"].value.y =
        1 / (height * pixelRatio);
      fxaaPass.enabled = false;
      fxaaPassRef.current = fxaaPass;
      composer.addPass(fxaaPass);
      // --- End of Setup Logic ---

      const handleResize = () => {
        if (
          !cameraRef.current ||
          !rendererRef.current ||
          !composerRef.current ||
          !outlinePassRef.current ||
          !fxaaPassRef.current ||
          !mountRef.current
        )
          return;
        const currentWidth = mountRef.current.clientWidth;
        const currentHeight = mountRef.current.clientHeight;
        if (currentWidth > 0 && currentHeight > 0) {
          cameraRef.current.aspect = currentWidth / currentHeight;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(currentWidth, currentHeight);
          composerRef.current.setSize(currentWidth, currentHeight);
          outlinePassRef.current.resolution.set(currentWidth, currentHeight);
          const newPixelRatio = rendererRef.current.getPixelRatio();
          fxaaPassRef.current.material.uniforms["resolution"].value.x =
            1 / (currentWidth * newPixelRatio);
          fxaaPassRef.current.material.uniforms["resolution"].value.y =
            1 / (currentHeight * newPixelRatio);
        } else {
          console.warn(
            "Resize event with zero dimensions detected during runtime."
          );
        }
      };

      handleResize();
      window.addEventListener("resize", handleResize);

      isInitializedRef.current = true;
      setInitializationStatus("ready");
      console.log("Scene setup complete, status set to ready.");

      // Return the cleanup function
      return () => {
        console.log("Cleaning up scene resources...");
        window.removeEventListener("resize", handleResize);

        if (sceneRef.current) {
          const scene = sceneRef.current;
          // Use lightsArray for cleanup
          lightsArray.forEach((light) => {
            if (
              light instanceof THREE.DirectionalLight &&
              light.target &&
              light.target.parent
            ) {
              scene.remove(light.target);
            }
            scene.remove(light);
          });
          if (floor) {
            scene.remove(floor);
          }
          // Remove lights explicitly just in case (belt and suspenders)
          if (ambientLightRef.current) scene.remove(ambientLightRef.current);
          if (hemisphereLightRef.current)
            scene.remove(hemisphereLightRef.current);
          if (mainDirectionalLightRef.current) {
            if (
              mainDirectionalLightRef.current.target &&
              mainDirectionalLightRef.current.target.parent
            ) {
              scene.remove(mainDirectionalLightRef.current.target);
            }
            scene.remove(mainDirectionalLightRef.current);
          }

          if (scene.environment) {
            scene.environment.dispose();
            scene.environment = null;
          }
        }
        if (floor) {
          floor.geometry.dispose();
          if (Array.isArray(floor.material)) {
            floor.material.forEach((m) => m.dispose());
          } else {
            floor.material.dispose();
          }
        }
        if (pmremGenerator) pmremGenerator.dispose();
        if (envTexture) envTexture.dispose();
        if (composerRef.current) {
          const composer = composerRef.current;
          composer.passes.forEach((pass) => {
            composer.removePass(pass);
          });
          if (composer.renderTarget1) composer.renderTarget1.dispose();
          if (composer.renderTarget2) composer.renderTarget2.dispose();
          renderTarget.dispose();
        }
        if (controlsRef.current) controlsRef.current.dispose();
        if (rendererRef.current) {
          if (rendererRef.current.domElement.parentNode === mountRef.current) {
            mountRef.current?.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current.dispose();
        }
        sceneRef.current = null;
        cameraRef.current = null;
        rendererRef.current = null;
        composerRef.current = null;
        outlinePassRef.current = null;
        fxaaPassRef.current = null;
        controlsRef.current = null;
        isInitializedRef.current = false;
        setInitializationStatus("pending");
        console.log("Scene cleanup complete, status reset to pending.");
      };
    };

    // --- Effect Execution Logic --- Always use ResizeObserver
    console.log("Setting up ResizeObserver...");
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        console.log(
          `ResizeObserver callback: ${width}x${height}, initialized: ${isInitializedRef.current}`
        );
        if (width > 0 && height > 0 && !isInitializedRef.current) {
          console.log(
            "ResizeObserver detected valid dimensions, running setup..."
          );
          // Run setup and store its cleanup function in the ref
          cleanupFuncRef.current = setup(width, height);

          // Stop observing ONLY if setup was successful and we are initialized
          if (isInitializedRef.current && resizeObserver) {
            console.log("Setup successful, stopping ResizeObserver.");
            // We disconnect here, the main cleanup will handle the ref
            resizeObserver.disconnect(); // Use disconnect inside callback too
            resizeObserver = null;
          }
        }
      }
    });

    resizeObserver.observe(currentMount);
    console.log("ResizeObserver observing mount point.");

    // Return the main cleanup function for the useEffect hook
    return () => {
      console.log("Running useEffect cleanup...");
      // Disconnect observer if it's still active
      if (resizeObserver) {
        console.log("Disconnecting active ResizeObserver in cleanup...");
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      // Call the stored cleanup function if setup was ever called
      if (cleanupFuncRef.current) {
        console.log("Calling stored setup cleanup function...");
        cleanupFuncRef.current();
        cleanupFuncRef.current = null; // Clear the ref
      }
      // Ensure isInitialized is reset even if cleanupFunc wasn't called (e.g., immediate unmount)
      if (isInitializedRef.current) {
        console.log("Resetting initialization flag in main cleanup.");
        isInitializedRef.current = false;
      }
      // Zawsze resetuj stan w głównym cleanupie
      setInitializationStatus("pending");
      console.log("useEffect cleanup finished.");
    };
  }, [mountRef, cameraHeight, setOutlineObjects]);

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    setOutlineObjects,
    initializationStatus,
    // Return new refs
    outlinePassRef,
    fxaaPassRef,
    ambientLightRef,
    hemisphereLightRef,
    mainDirectionalLightRef,
  };
};
