import { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { usePlayerControls } from "../hooks/usePlayerControls";
import { useVaseManager } from "../hooks/useVaseManager";
import { useSceneSetup } from "../hooks/useSceneSetup";
import { useShardManager } from "../hooks/useShardManager";
import { useGalleryLoader } from "../hooks/useGalleryLoader";
import { useControls, folder, button, levaStore } from "leva";
import {
  ACESFilmicToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  NoToneMapping,
  NormalBlending,
  AdditiveBlending,
  SubtractiveBlending,
  MultiplyBlending,
} from "three";
import yaml from "js-yaml";
import initialSettingsFromJson from "../config/sceneSettings.json";

export const GreekVases = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [cameraHeight] = useState(2.5);
  const isPointerLockedRef = useRef(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [brokenVasesCount] = useState(0);
  const [isTouchControlActive, setIsTouchControlActive] = useState(false);
  const textureRefs = useRef<{
    windowTexture: THREE.Texture | null;
    backgroundTexture: THREE.Texture | null;
  }>({
    windowTexture: null,
    backgroundTexture: null,
  });

  // Setup scene, camera, renderer, composer using the hook
  const {
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    setOutlineObjects,
    initializationStatus,
    outlinePassRef,
    fxaaPassRef,
    ambientLightRef,
    hemisphereLightRef,
    mainDirectionalLightRef,
  } = useSceneSetup({
    mountRef,
    cameraHeight: 3,
  });

  // Get refs from gallery loader, including RectAreaLight
  const {
    galleryModel,
    windowPane,
    backgroundPlane,
    galleryDirectionalLightRef,
    rectAreaLightRef,
  } = useGalleryLoader({
    sceneRef,
    initializationStatus,
  });

  const initialBackgroundPosition = useRef<THREE.Vector3 | null>(null);

  // Initialize Vase Manager FIRST
  const { handleVaseClick, setOnVaseBrokenCallback, vasesRef, pedestalsRef } =
    useVaseManager({
      sceneRef,
      cameraRef,
      onVasesCreated: () => {
        if (initializationStatus === "ready" && setOutlineObjects) {
          const objectsToOutline = [
            ...(vasesRef.current || []),
            ...(pedestalsRef.current || []),
          ];
          console.log(
            "[GreekVases onVasesCreated] Refreshing outlines with:",
            objectsToOutline.length,
            "objects"
          );
          setOutlineObjects(objectsToOutline);
        } else {
          console.warn(
            "[GreekVases onVasesCreated] Skipping outline refresh - scene not ready or setOutlineObjects not available."
          );
        }
      },
    });

  // Initialize Player Controls SECOND
  const { updatePlayerPosition, joystickCenter, joystickRadius } =
    usePlayerControls({
      isPointerLocked: isPointerLockedRef.current,
      cameraRef,
      cameraHeight,
      setIsTouchControlActive,
      handleVaseClick,
    });

  // Initialize Shard Manager
  const { createShards, updateShards, cleanupShards } = useShardManager({
    sceneRef,
  });

  // Use imported settings, provide defaults for new window/background controls
  const initialSettings = {
    ...initialSettingsFromJson,
    // Window Pane Defaults
    "Window Opacity": 0.8, // Adjusted default
    "Window Blending": AdditiveBlending,
    "Window Color": "#ffffff",
    "Window Render Order": 0,
    // Background Plane Defaults
    "Background Color": "#ffffff",
    "Background Emissive": "#000000",
    "Background Emissive Intensity": 0,
    "Background Render Order": 0,
    // Rect Light Defaults (already exist)
    "Rect Light Intensity": 5.0, // Default value
    "Rect Light Color": "#ffffff", // Default value
    "Rect Light Width": 35 * 0.95, // Default from creation logic
    "Rect Light Height": 12 * 0.95, // Default from creation logic
    // Parallax Background Defaults
    "Parallax BG Color": "#ffffff",
    "Parallax BG Emissive": "#000000",
    "Parallax BG Emissive Intensity": 0,
    "Parallax BG Opacity": 1.0,
    "Parallax BG Render Order": -1, // Default behind window
  } as { [key: string]: any };

  // Extract the export logic handler
  const handleExportClick = useCallback(() => {
    console.log("Exporting settings using levaStore.getData()...");
    const allData = levaStore.getData();
    console.log("Raw leva store data:", JSON.stringify(allData, null, 2));
    const valuesToExport: { [key: string]: any } = {};
    Object.keys(allData).forEach((key) => {
      const entry = allData[key];
      if (
        entry &&
        typeof entry === "object" &&
        !(entry instanceof Element) &&
        "value" in entry &&
        typeof entry.value !== "function"
      ) {
        const exportKey = entry.label || key;
        // @ts-expect-error - Linter struggles with levaStore type, but runtime works
        valuesToExport[exportKey] = entry.value;
      }
    });
    console.log(
      "Filtered values for export:",
      JSON.stringify(valuesToExport, null, 2)
    );
    if (Object.keys(valuesToExport).length === 0) {
      console.error(
        "No settings found to export after filtering levaStore data."
      );
      return;
    }
    try {
      const yamlString = yaml.dump(valuesToExport, { indent: 2 });
      navigator.clipboard
        .writeText(yamlString)
        .then(() => {
          console.log("Settings copied to clipboard as YAML!");
        })
        .catch((err) => {
          console.error("Failed to copy settings to clipboard:", err);
        });
    } catch (e) {
      console.error("Failed to convert settings to YAML:", e);
    }
  }, []);

  // --- Leva Debug Panel Controls ---
  useControls(
    () => ({
      Renderer: folder({
        "Tone Mapping": {
          value: initialSettings["Tone Mapping"],
          options: {
            None: NoToneMapping,
            Linear: LinearToneMapping,
            Reinhard: ReinhardToneMapping,
            Cineon: CineonToneMapping,
            ACESFilmic: ACESFilmicToneMapping,
          },
          onChange: (v) => {
            if (rendererRef.current) rendererRef.current.toneMapping = v;
          },
        },
        Exposure: {
          value: initialSettings["Exposure"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (rendererRef.current)
              rendererRef.current.toneMappingExposure = v;
          },
        },
        "Env Intensity": {
          value: initialSettings["Env Intensity"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (sceneRef.current) sceneRef.current.environmentIntensity = v;
          },
        },
        Background: {
          value: initialSettings["Background"],
          onChange: (v) => {
            if (sceneRef.current) {
              // Ensure we set a Color object if the input changes
              if (!(sceneRef.current.background instanceof THREE.Color)) {
                sceneRef.current.background = new THREE.Color();
              }
              sceneRef.current.background.set(v);
            }
          },
        },
      }),
      Lights: folder({
        "Ambient Intensity": {
          value: initialSettings["Ambient Intensity"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (ambientLightRef.current) ambientLightRef.current.intensity = v;
          },
        },
        "Ambient Color": {
          value: initialSettings["Ambient Color"],
          onChange: (v) => {
            if (ambientLightRef.current) ambientLightRef.current.color.set(v);
          },
        },
        "Hemi Intensity": {
          value: initialSettings["Hemi Intensity"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (hemisphereLightRef.current)
              hemisphereLightRef.current.intensity = v;
          },
        },
        "Hemi Sky Color": {
          value: initialSettings["Hemi Sky Color"],
          onChange: (v) => {
            if (hemisphereLightRef.current)
              hemisphereLightRef.current.color.set(v);
          },
        },
        "Hemi Ground Color": {
          value: initialSettings["Hemi Ground Color"],
          onChange: (v) => {
            if (hemisphereLightRef.current)
              hemisphereLightRef.current.groundColor.set(v);
          },
        },
        "Main Dir Intensity": {
          value: initialSettings["Main Dir Intensity"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (mainDirectionalLightRef.current)
              mainDirectionalLightRef.current.intensity = v;
          },
        },
        "Main Dir Color": {
          value: initialSettings["Main Dir Color"],
          onChange: (v) => {
            if (mainDirectionalLightRef.current)
              mainDirectionalLightRef.current.color.set(v);
          },
        },
        "Main Dir Shadow Bias": {
          value: initialSettings["Main Dir Shadow Bias"],
          min: -0.01,
          max: 0.01,
          step: 0.0001,
          onChange: (v) => {
            if (mainDirectionalLightRef.current)
              mainDirectionalLightRef.current.shadow.bias = v;
          },
        },
        "Main Dir Shadow Radius": {
          value: initialSettings["Main Dir Shadow Radius"],
          min: 0,
          max: 20,
          step: 0.1,
          onChange: (v) => {
            if (mainDirectionalLightRef.current)
              mainDirectionalLightRef.current.shadow.radius = v;
          },
        },
        "Gallery Dir Intensity": {
          value: initialSettings["Gallery Dir Intensity"],
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (v) => {
            if (galleryDirectionalLightRef.current)
              galleryDirectionalLightRef.current.intensity = v;
          },
        },
        "Gallery Dir Color": {
          value: initialSettings["Gallery Dir Color"],
          onChange: (v) => {
            if (galleryDirectionalLightRef.current)
              galleryDirectionalLightRef.current.color.set(v);
          },
        },
        "Gallery Dir Shadow Bias": {
          value: initialSettings["Gallery Dir Shadow Bias"],
          min: -0.01,
          max: 0.01,
          step: 0.0001,
          onChange: (v) => {
            if (galleryDirectionalLightRef.current)
              galleryDirectionalLightRef.current.shadow.bias = v;
          },
        },
        "Gallery Dir Shadow Radius": {
          value: initialSettings["Gallery Dir Shadow Radius"],
          min: 0,
          max: 20,
          step: 0.1,
          onChange: (v) => {
            if (galleryDirectionalLightRef.current)
              galleryDirectionalLightRef.current.shadow.radius = v;
          },
        },
      }),
      Window: folder({
        Opacity: {
          value: initialSettings["Window Opacity"],
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => {
            if (windowPane?.material && !Array.isArray(windowPane.material)) {
              windowPane.material.opacity = v;
            }
          },
          render: (_get) => !!windowPane,
        },
        Blending: {
          value: initialSettings["Window Blending"],
          options: {
            Normal: NormalBlending,
            Additive: AdditiveBlending,
            Subtractive: SubtractiveBlending,
            Multiply: MultiplyBlending,
          },
          onChange: (v) => {
            if (windowPane?.material && !Array.isArray(windowPane.material)) {
              windowPane.material.blending = v;
              windowPane.material.needsUpdate = true; // Important for blending change
            }
          },
          render: (_get) => !!windowPane,
        },
        Color: {
          value: initialSettings["Window Color"],
          onChange: (v) => {
            if (
              windowPane?.material &&
              windowPane.material instanceof THREE.MeshBasicMaterial
            ) {
              windowPane.material.color.set(v);
            }
          },
          render: (_get) => !!windowPane,
        },
        "Render Order": {
          value: initialSettings["Window Render Order"],
          min: -10,
          max: 10,
          step: 1,
          onChange: (v) => {
            if (windowPane) windowPane.renderOrder = v;
          },
          render: (_get) => !!windowPane,
        },
        "Rect Light Intensity": {
          value: initialSettings["Rect Light Intensity"],
          min: 0,
          max: 50,
          step: 0.1, // Increased max range
          onChange: (v) => {
            if (rectAreaLightRef.current)
              rectAreaLightRef.current.intensity = v;
          },
          render: (_get) => !!rectAreaLightRef.current,
        },
        "Rect Light Color": {
          value: initialSettings["Rect Light Color"],
          onChange: (v) => {
            if (rectAreaLightRef.current) rectAreaLightRef.current.color.set(v);
          },
          render: (_get) => !!rectAreaLightRef.current,
        },
        "Rect Light Width": {
          value: initialSettings["Rect Light Width"],
          min: 1,
          max: 50,
          step: 0.1,
          onChange: (v) => {
            if (rectAreaLightRef.current) rectAreaLightRef.current.width = v;
          },
          render: (_get) => !!rectAreaLightRef.current,
        },
        "Rect Light Height": {
          value: initialSettings["Rect Light Height"],
          min: 1,
          max: 50,
          step: 0.1,
          onChange: (v) => {
            if (rectAreaLightRef.current) rectAreaLightRef.current.height = v;
          },
          render: (_get) => !!rectAreaLightRef.current,
        },
      }),
      "Parallax BG": folder({
        Color: {
          value: initialSettings["Parallax BG Color"],
          onChange: (v) => {
            if (
              backgroundPlane?.material instanceof THREE.MeshStandardMaterial
            ) {
              backgroundPlane.material.color.set(v);
            }
          },
          render: (_get) =>
            !!backgroundPlane &&
            backgroundPlane.material instanceof THREE.MeshStandardMaterial,
        },
        Emissive: {
          value: initialSettings["Parallax BG Emissive"],
          onChange: (v) => {
            if (
              backgroundPlane?.material instanceof THREE.MeshStandardMaterial
            ) {
              backgroundPlane.material.emissive.set(v);
            }
          },
          render: (_get) =>
            !!backgroundPlane &&
            backgroundPlane.material instanceof THREE.MeshStandardMaterial,
        },
        "Emissive Intensity": {
          value: initialSettings["Parallax BG Emissive Intensity"],
          min: 0,
          max: 5,
          step: 0.01,
          onChange: (v) => {
            if (
              backgroundPlane?.material instanceof THREE.MeshStandardMaterial
            ) {
              backgroundPlane.material.emissiveIntensity = v;
            }
          },
          render: (_get) =>
            !!backgroundPlane &&
            backgroundPlane.material instanceof THREE.MeshStandardMaterial,
        },
        Opacity: {
          value: initialSettings["Parallax BG Opacity"],
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => {
            if (
              backgroundPlane?.material &&
              !Array.isArray(backgroundPlane.material)
            ) {
              backgroundPlane.material.transparent = v < 1.0;
              backgroundPlane.material.opacity = v;
              backgroundPlane.material.needsUpdate = true;
            }
          },
          render: (_get) => !!backgroundPlane,
        },
        "Render Order": {
          value: initialSettings["Parallax BG Render Order"],
          min: -10,
          max: 10,
          step: 1,
          onChange: (v) => {
            if (backgroundPlane) backgroundPlane.renderOrder = v;
          },
          render: (_get) => !!backgroundPlane,
        },
      }),
      "Post-Processing": folder({
        "Outline Strength": {
          value: initialSettings["Outline Strength"],
          min: 0,
          max: 10,
          step: 0.1,
          onChange: (v) => {
            if (outlinePassRef.current) outlinePassRef.current.edgeStrength = v;
          },
        },
        "Outline Thickness": {
          value: initialSettings["Outline Thickness"],
          min: 0,
          max: 4,
          step: 0.1,
          onChange: (v) => {
            if (outlinePassRef.current)
              outlinePassRef.current.edgeThickness = v;
          },
        },
        "Outline Glow": {
          value: initialSettings["Outline Glow"],
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (v) => {
            if (outlinePassRef.current) outlinePassRef.current.edgeGlow = v;
          },
        },
        "Outline Visible Color": {
          value: initialSettings["Outline Visible Color"],
          onChange: (v) => {
            if (outlinePassRef.current)
              outlinePassRef.current.visibleEdgeColor.set(v);
          },
        },
        "Outline Hidden Color": {
          value: initialSettings["Outline Hidden Color"],
          onChange: (v) => {
            if (outlinePassRef.current)
              outlinePassRef.current.hiddenEdgeColor.set(v);
          },
        },
        "Enable FXAA": {
          value: initialSettings["Enable FXAA"],
          onChange: (v) => {
            if (fxaaPassRef.current) fxaaPassRef.current.enabled = v;
          },
        },
      }),
      "Copy Settings (YAML)": button(handleExportClick),
    }),
    // Dependencies
    [
      rendererRef,
      sceneRef,
      ambientLightRef,
      hemisphereLightRef,
      mainDirectionalLightRef,
      galleryDirectionalLightRef,
      outlinePassRef,
      fxaaPassRef,
      rectAreaLightRef,
      backgroundPlane,
    ]
  );
  // --- End Leva Controls ---

  // Effect to apply initial settings directly to Three.js objects after mount
  useEffect(() => {
    if (
      rendererRef.current &&
      sceneRef.current &&
      ambientLightRef.current &&
      hemisphereLightRef.current &&
      mainDirectionalLightRef.current &&
      outlinePassRef.current &&
      fxaaPassRef.current &&
      rectAreaLightRef.current &&
      windowPane &&
      backgroundPlane
    ) {
      console.log(
        "Applying initialSettings from JSON directly to Three.js objects..."
      );

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const ambientLight = ambientLightRef.current;
      const hemisphereLight = hemisphereLightRef.current;
      const mainDirLight = mainDirectionalLightRef.current;
      const outlinePass = outlinePassRef.current;
      const fxaaPass = fxaaPassRef.current;
      const rectAreaLight = rectAreaLightRef.current;

      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = initialSettings["Exposure"];
      scene.environmentIntensity = initialSettings["Env Intensity"];
      if (scene.background instanceof THREE.Color) {
        scene.background.set(initialSettings["Background"]);
      } else {
        scene.background = new THREE.Color(initialSettings["Background"]);
      }

      ambientLight.intensity = initialSettings["Ambient Intensity"];
      ambientLight.color.set(initialSettings["Ambient Color"]);
      hemisphereLight.intensity = initialSettings["Hemi Intensity"];
      hemisphereLight.color.set(initialSettings["Hemi Sky Color"]);
      hemisphereLight.groundColor.set(initialSettings["Hemi Ground Color"]);
      mainDirLight.intensity = initialSettings["Main Dir Intensity"];
      mainDirLight.color.set(initialSettings["Main Dir Color"]);
      mainDirLight.shadow.bias = initialSettings["Main Dir Shadow Bias"];
      mainDirLight.shadow.radius = initialSettings["Main Dir Shadow Radius"];

      if (galleryDirectionalLightRef.current) {
        const galleryDirLight = galleryDirectionalLightRef.current;
        galleryDirLight.intensity = initialSettings["Gallery Dir Intensity"];
        galleryDirLight.color.set(initialSettings["Gallery Dir Color"]);
        galleryDirLight.shadow.bias =
          initialSettings["Gallery Dir Shadow Bias"];
        galleryDirLight.shadow.radius =
          initialSettings["Gallery Dir Shadow Radius"];
      }

      outlinePass.edgeStrength = initialSettings["Outline Strength"];
      outlinePass.edgeThickness = initialSettings["Outline Thickness"];
      outlinePass.edgeGlow = initialSettings["Outline Glow"];
      outlinePass.visibleEdgeColor.set(
        initialSettings["Outline Visible Color"]
      );
      outlinePass.hiddenEdgeColor.set(initialSettings["Outline Hidden Color"]);
      fxaaPass.enabled = initialSettings["Enable FXAA"];

      // Apply initial Window settings
      if (
        windowPane?.material &&
        windowPane.material instanceof THREE.MeshBasicMaterial
      ) {
        windowPane.material.opacity = initialSettings["Window Opacity"];
        windowPane.material.blending = initialSettings["Window Blending"];
        windowPane.material.needsUpdate = true;
        windowPane.material.color.set(initialSettings["Window Color"]);
        windowPane.renderOrder = initialSettings["Window Render Order"];
      }

      // Apply initial Background settings
      if (backgroundPlane?.material instanceof THREE.MeshStandardMaterial) {
        backgroundPlane.material.color.set(initialSettings["Background Color"]);
        backgroundPlane.material.emissive.set(
          initialSettings["Background Emissive"]
        );
        backgroundPlane.material.emissiveIntensity =
          initialSettings["Background Emissive Intensity"];
        backgroundPlane.renderOrder =
          initialSettings["Background Render Order"];
      }

      if (rectAreaLight && mainDirLight) {
        console.log(
          "Applying initial settings to RectAreaLight:",
          initialSettings["Main Dir Intensity"],
          initialSettings["Main Dir Color"]
        );
        rectAreaLight.intensity = initialSettings["Main Dir Intensity"] * 15;
        rectAreaLight.color.set(initialSettings["Main Dir Color"]);
      }

      // Apply initial Parallax Background settings
      if (backgroundPlane?.material instanceof THREE.MeshStandardMaterial) {
        backgroundPlane.material.color.set(
          initialSettings["Parallax BG Color"]
        );
        backgroundPlane.material.emissive.set(
          initialSettings["Parallax BG Emissive"]
        );
        backgroundPlane.material.emissiveIntensity =
          initialSettings["Parallax BG Emissive Intensity"];
      }
      // Apply opacity and renderOrder regardless of material type initially?
      if (
        backgroundPlane?.material &&
        !Array.isArray(backgroundPlane.material)
      ) {
        backgroundPlane.material.transparent =
          initialSettings["Parallax BG Opacity"] < 1.0;
        backgroundPlane.material.opacity =
          initialSettings["Parallax BG Opacity"];
        backgroundPlane.material.needsUpdate = true;
      }
      if (backgroundPlane) {
        // Apply render order separately
        backgroundPlane.renderOrder =
          initialSettings["Parallax BG Render Order"];
      }

      console.log("Initial settings applied directly to Three.js objects.");
    }
  }, [
    rendererRef.current,
    sceneRef.current,
    ambientLightRef.current,
    hemisphereLightRef.current,
    mainDirectionalLightRef.current,
    galleryDirectionalLightRef.current,
    outlinePassRef.current,
    fxaaPassRef.current,
    rectAreaLightRef.current,
    windowPane,
    backgroundPlane,
  ]);

  // Add gallery objects to the scene imperatively when they are loaded
  useEffect(() => {
    if (initializationStatus !== "ready" || !sceneRef.current) {
      console.log(
        `Add gallery objects useEffect skipped: status=${initializationStatus}, sceneRef=${!!sceneRef.current}`
      );
      return;
    }
    const scene = sceneRef.current;
    console.log("--- Add Gallery Objects useEffect START ---");
    console.log("Current values:", {
      galleryModel: galleryModel
        ? `${galleryModel.name} (ID: ${galleryModel.uuid.substring(0, 6)})`
        : null,
      windowPane: windowPane
        ? `${windowPane.name} (ID: ${windowPane.uuid.substring(0, 6)})`
        : null,
      backgroundPlane: backgroundPlane
        ? `${backgroundPlane.name} (ID: ${backgroundPlane.uuid.substring(
            0,
            6
          )})`
        : null,
    });

    const lightToAdd = galleryDirectionalLightRef.current;
    const rectLightToAdd = rectAreaLightRef.current;

    const objectsToAdd: (THREE.Object3D | null)[] = [
      galleryModel,
      windowPane,
      backgroundPlane,
      lightToAdd,
      rectLightToAdd,
    ];

    objectsToAdd.forEach((obj) => {
      if (obj) {
        if (!obj.parent) {
          console.log(
            `Adding object to scene: ${
              obj.name || obj.type
            } (ID: ${obj.uuid.substring(0, 6)})`
          );
          scene.add(obj);
          if (
            obj === lightToAdd &&
            obj instanceof THREE.DirectionalLight &&
            !obj.target.parent
          ) {
            if (!scene.children.includes(obj.target)) {
              console.log(`Adding light target for ${obj.name} to scene.`);
              scene.add(obj.target);
            } else {
              console.log(`Light target for ${obj.name} already in scene.`);
            }
          }
          if (obj === rectLightToAdd) {
            console.log("ADDED RectAreaLight to scene:", obj);
          }
        } else {
          console.log(
            `Object ${obj.name || obj.type} (ID: ${obj.uuid.substring(
              0,
              6
            )}) already has parent: ${obj.parent.name || obj.parent.type}`
          );
        }
        if (obj === backgroundPlane && !initialBackgroundPosition.current) {
          initialBackgroundPosition.current = obj.position.clone();
          console.log(
            `Initial background position set:`,
            initialBackgroundPosition.current
          );
        }
      } else {
        console.log(
          "Encountered null object in objectsToAdd array (potentially light not ready)."
        );
      }
    });
    console.log(
      "Scene children after attempting add:",
      scene.children.map((c) => c.name || c.type)
    );

    return () => {
      console.log("--- Add Gallery Objects useEffect CLEANUP --- ");
      objectsToAdd.forEach((obj) => {
        if (obj && obj.parent === scene) {
          console.log(
            `Removing object from scene: ${
              obj.name || obj.type
            } (ID: ${obj.uuid.substring(0, 6)})`
          );
          scene.remove(obj);
          if (
            obj === lightToAdd &&
            obj instanceof THREE.DirectionalLight &&
            obj.target.parent === scene
          ) {
            console.log(`Removing light target for ${obj.name} from scene.`);
            scene.remove(obj.target);
          }
        }
      });
      console.log(
        "Scene children after cleanup:",
        scene.children.map((c) => c.name || c.type)
      );
    };
  }, [
    initializationStatus,
    sceneRef,
    galleryModel,
    windowPane,
    backgroundPlane,
    galleryDirectionalLightRef,
    rectAreaLightRef,
  ]);

  // Pointer Lock Handlers
  const handlePointerLockChange = useCallback(() => {
    const locked = document.pointerLockElement === mountRef.current;
    console.log("Pointer lock change detected. Locked:", locked);
    setIsPointerLocked(locked);
    isPointerLockedRef.current = locked;
  }, [mountRef]);

  const handlePointerLockError = useCallback(() => {
    console.error("Pointer Lock Error");
    setIsPointerLocked(false);
    isPointerLockedRef.current = false;
  }, []);

  // Main effect for animation loop and non-hook event listeners
  useEffect(() => {
    console.log(
      `--- Animation Loop useEffect START (Status: ${initializationStatus}) ---`
    );

    if (initializationStatus !== "ready") {
      console.log(
        "--- Animation Loop useEffect: Status NOT READY, exiting. ---"
      );
      return;
    }

    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) {
      console.error(
        "--- Animation Loop useEffect: Status READY but refs are NULL! This shouldn't happen. Exiting. ---"
      );
      return;
    }

    console.log("--- Animation Loop useEffect: Status READY, proceeding. ---");

    const currentScene = sceneRef.current;
    const currentRenderer = rendererRef.current;
    const currentCamera = cameraRef.current;
    const currentComposer = composerRef.current;

    // Click handler for pointer lock (DESKTOP ONLY)
    const combinedMouseClickHandler = () => {
      if (!isTouchControlActive && isPointerLockedRef.current) {
        handleVaseClick();
      }
    };

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);

      // Parallax Effect
      if (
        backgroundPlane &&
        initialBackgroundPosition.current &&
        cameraRef.current
      ) {
        const parallaxFactor = 0.1;
        const camera = cameraRef.current;
        const offsetX = -(camera.position.x * parallaxFactor);
        const offsetY = -(camera.position.y * parallaxFactor * 0.5);

        backgroundPlane.position.x =
          initialBackgroundPosition.current.x + offsetX;
        backgroundPlane.position.y =
          initialBackgroundPosition.current.y + offsetY;
        backgroundPlane.position.z = initialBackgroundPosition.current.z;
      }

      // Update player position
      if (isPointerLockedRef.current || isTouchControlActive) {
        updatePlayerPosition();
      }

      updateShards();

      // Vase Levitation
      const time = performance.now() * 0.001;
      const levitationSpeed = 1.5;
      const levitationAmplitude = 0.05;
      const levitationBaseOffset = 0.15;

      if (vasesRef.current) {
        vasesRef.current.forEach((vase) => {
          if (
            vase.userData.initialY !== undefined &&
            vase.userData.phaseOffset !== undefined
          ) {
            const initialY = vase.userData.initialY;
            const phaseOffset = vase.userData.phaseOffset;
            const offsetY =
              Math.sin(time * levitationSpeed + phaseOffset) *
              levitationAmplitude;
            vase.position.y = initialY + levitationBaseOffset + offsetY;
          }
        });
      }

      // Render scene (przywrócono renderowanie przez composer)
      if (currentComposer) {
        currentComposer.render();
      } else {
        console.warn("Composer not found, using direct renderer");
        currentRenderer.render(currentScene, currentCamera);
      }
    }

    console.log("--- Animation Loop useEffect: Starting animation loop... ---");
    animate();

    // Event Listeners
    const handleMountClick = () => {
      if (!isTouchControlActive && !isPointerLocked) {
        console.log("Requesting pointer lock via mount click...");
        mountRef.current?.requestPointerLock();
      }
    };
    if (mountRef.current) {
      mountRef.current.addEventListener("click", handleMountClick);
    }
    window.addEventListener("click", combinedMouseClickHandler);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);

    // Cleanup
    return () => {
      console.log("--- Animation Loop useEffect CLEANUP --- ");
      if (mountRef.current) {
        mountRef.current.removeEventListener("click", handleMountClick);
      }
      window.removeEventListener("click", combinedMouseClickHandler);
      document.removeEventListener(
        "pointerlockchange",
        handlePointerLockChange
      );
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      cleanupShards();
      cancelAnimationFrame(animationId);
    };
  }, [
    initializationStatus,
    sceneRef,
    cameraRef,
    rendererRef,
    composerRef,
    isTouchControlActive,
    handlePointerLockChange,
    handlePointerLockError,
    updatePlayerPosition,
    handleVaseClick,
    updateShards,
    cleanupShards,
    backgroundPlane,
  ]);

  // Effect to set outline objects when vases are ready
  useEffect(() => {
    if (initializationStatus === "ready") {
      setOutlineObjects(vasesRef.current || []);
    }
  }, [
    initializationStatus,
    vasesRef.current,
    pedestalsRef.current,
    setOutlineObjects,
  ]);

  // Connect Vase Manager break event to Shard Manager creation
  useEffect(() => {
    setOnVaseBrokenCallback((info) => {
      createShards(info);
      setOutlineObjects(vasesRef.current || []);
    });
    return () => setOnVaseBrokenCallback(() => {});
  }, [
    setOnVaseBrokenCallback,
    createShards,
    setOutlineObjects,
    vasesRef.current,
  ]);

  // Cleanup textures when component unmounts
  useEffect(() => {
    return () => {
      if (textureRefs.current.windowTexture) {
        textureRefs.current.windowTexture.dispose();
        textureRefs.current.windowTexture = null;
      }
      if (textureRefs.current.backgroundTexture) {
        textureRefs.current.backgroundTexture.dispose();
        textureRefs.current.backgroundTexture = null;
      }
    };
  }, []);

  return (
    <div className="greek-vases-container">
      <div ref={mountRef} className="canvas-container" />
      <div className="broken-vases-counter" data-testid="broken-vases-counter">
        Broken Vases: {brokenVasesCount}
      </div>
      <div className="controls-info" data-testid="controls-info">
        Użyj WSAD, aby się poruszać. Kliknij, aby rozbić wazę.
      </div>
      <div
        className={`crosshair ${isPointerLocked ? "active" : ""}`}
        data-testid="crosshair"
      />

      {isTouchControlActive && joystickCenter && joystickRadius > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${joystickCenter.x}px`,
            top: `${joystickCenter.y}px`,
            width: `${joystickRadius * 2}px`,
            height: `${joystickRadius * 2}px`,
            borderRadius: "50%",
            border: "1px dotted rgba(0, 0, 0, 0.3)",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(3px)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
          data-testid="joystick-area"
        />
      )}

      {!isPointerLocked && !isTouchControlActive && (
        <div className="instruction-overlay" data-testid="instruction-overlay">
          Kliknij, aby rozpocząć
        </div>
      )}
    </div>
  );
};

export default GreekVases;
