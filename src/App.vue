<template>
  <div id="app-32-map" class="is-full"></div>
  
  <div v-if="showStats" class="camera-stats-ui">
    <div><strong>Pos:</strong> X:{{ cameraStats.x }} Y:{{ cameraStats.y }} Z:{{ cameraStats.z }}</div>
    <div><strong>Tgt:</strong> X:{{ cameraStats.targetX }} Y:{{ cameraStats.targetY }} Z:{{ cameraStats.targetZ }}</div>
    <div><strong>Rot:</strong> A:{{ cameraStats.alpha }} B:{{ cameraStats.beta }} R:{{ cameraStats.radius }}</div>
  </div>

  <button class="stats-toggle-btn" @click="showStats = !showStats">
    {{ showStats ? '关闭参数' : '显示参数' }}
  </button>
</template>

<script>
import Map3d from "@/utils/Map3d.js"
import {
  Vector3,
  Color3,
  MeshBuilder,
  StandardMaterial,
  Texture,
  Color4,
  HemisphericLight,
  DirectionalLight,
  TransformNode,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  GlowLayer,
  VertexBuffer
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import earcut from "earcut";
import TWEEN from "@tweenjs/tween.js";
import { onBeforeUnmount, onMounted, reactive, ref } from "vue"
import useFileLoader from "@/hooks/useFileLoader.js"
import useConversionStandardData from "@/hooks/useConversionStandardData.js"
import useCountry from "@/hooks/useCountry.js"
import useCoord from "@/hooks/useCoord.js"
import useMarkedLightPillar from "@/hooks/map/useMapMarkedLightPillar.js"
import useRisingParticles from "@/hooks/map/useRisingParticles.js"
import { random } from "@/utils"

let centerXY = [120.153576, 30.287459]

export default {
  name: "3dMapGd",
  setup() {
    const showStats = ref(true)
    const cameraStats = reactive({
      x: 0, y: 0, z: 0,
      alpha: 0, beta: 0, radius: 0,
      targetX: 0, targetY: 0, targetZ: 0
    })

    let baseMap = null

    // 重置
    const resize = () => {
      if (baseMap) baseMap.resize()
    }

    const { requestData } = useFileLoader()
    const { transfromGeoJSON } = useConversionStandardData()
    const { createCountryFlatLine } = useCountry()
    const { getBoundingBox } = useCoord()

    const { createLightPillar } = useMarkedLightPillar({
        scaleFactor: 1.2
    });

    onMounted(async () => {
      // 加载浙江省数据文件
      let provinceData = await requestData("./data/map/浙江省.geojson")
      provinceData = transfromGeoJSON(provinceData)

      class CurrentMap3d extends Map3d {
        constructor(props) {
          super(props)
          this.currentSelectedMesh = null;
          this.currentBorderMesh = null;
        }
        
        initCamera() {
          super.initCamera();
          this.camera.setPosition(new Vector3(120.98, 4.23, 23.13)); 
          this.camera.setTarget(new Vector3(120.64, -0.58, 28.96));
          this.camera.alpha = -1.51;
          this.camera.beta = 0.88;
          this.camera.radius = 7.57;
          
          // Debug: Log camera position and pick info
          this.scene.onPointerObservable.add((pointerInfo) => {
              if (pointerInfo.type === 1) { // POINTERDOWN
                  if (showStats.value) {
                    console.log("Camera Position:", this.camera.position);
                    console.log("Camera Target:", this.camera.target);
                  }
                  
                  if (pointerInfo.pickInfo && pointerInfo.pickInfo.hit) {
                      console.log("Picked:", pointerInfo.pickInfo.pickedMesh.name);
                      if (pointerInfo.pickInfo.pickedMesh.metadata) {
                          console.log("Metadata Properties:", pointerInfo.pickInfo.pickedMesh.metadata.properties);
                      }
                  } else {
                      console.log("Picked: Nothing");
                  }
              }
          });
          
          // Adjust camera controls limits if needed
          this.camera.lowerRadiusLimit = 2;
          this.camera.upperRadiusLimit = 200;
          this.camera.panningSensibility = 2000;
          this.camera.wheelPrecision = 50;
          this.camera.upperBetaLimit = Math.PI / 2; // Prevent camera from going below ground

          // Update UI stats
          this.scene.registerBeforeRender(() => {
            if (this.camera && showStats.value) {
              cameraStats.x = this.camera.position.x.toFixed(2);
              cameraStats.y = this.camera.position.y.toFixed(2);
              cameraStats.z = this.camera.position.z.toFixed(2);
              cameraStats.alpha = this.camera.alpha.toFixed(3);
              cameraStats.beta = this.camera.beta.toFixed(3);
              cameraStats.radius = this.camera.radius.toFixed(2);
              if (this.camera.target) {
                cameraStats.targetX = this.camera.target.x.toFixed(2);
                cameraStats.targetY = this.camera.target.y.toFixed(2);
                cameraStats.targetZ = this.camera.target.z.toFixed(2);
              }
            }
          });
        }

        initLight() {
            // Babylon.js lighting
            const light1 = new HemisphericLight("light1", new Vector3(0, 1, 0), this.scene);
            light1.intensity = 0.5; // Slightly increased ambient light

            const light2 = new DirectionalLight("dir01", new Vector3(-1, -2, -1), this.scene);
            light2.position = new Vector3(20, 40, 20);
            light2.intensity = 0.5;

            // Add Glow Layer for the "tech" bloom effect
            this.glowLayer = new GlowLayer("glow", this.scene, { 
                mainTextureFixedSize: 1024,
                blurKernelSize: 64 
            });
            this.glowLayer.intensity = 1.2;
        }

        initModel() {
            this.lightPillars = []; // Initialize array for pillars
            this.mapGroup = new TransformNode("mapGroup", this.scene);

            const textureMap = new Texture("/data/map/gz-map.jpg", this.scene);
            const mat = new StandardMaterial("mat", this.scene);
            mat.diffuseTexture = textureMap;
            // Dark Teal color for the map (Brighter)
            mat.diffuseColor = Color3.FromHexString("#0E4040"); 
            mat.specularColor = new Color3(0, 0, 0);
            // Double brightness as requested (approx #2C8080)
            mat.emissiveColor = Color3.FromHexString("#2C8080"); 

            // Define a dimmer material for unselected meshes
            const dimMat = new StandardMaterial("dimMat", this.scene);
            dimMat.diffuseTexture = textureMap;
            dimMat.diffuseColor = Color3.FromHexString("#051515"); // Much darker
            dimMat.specularColor = new Color3(0, 0, 0);
            dimMat.emissiveColor = Color3.FromHexString("#0A2020"); // Very dim emissive 
            
            const highlightMat = new StandardMaterial("highlightMat", this.scene);
            highlightMat.diffuseTexture = textureMap;
            // Bright Cyan for highlight (Distinct but not neon)
            highlightMat.diffuseColor = Color3.FromHexString("#22FFFF"); 
            highlightMat.specularColor = new Color3(0.5, 0.5, 0.5);
            highlightMat.emissiveColor = Color3.FromHexString("#004444"); // Moderate emissive

            const earcutLib = earcut.default || earcut;
            
            // GUI for Labels
            const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");

            // Iterate features
            provinceData.features.forEach((elem) => {
                const coordinates = elem.geometry.coordinates;
                const properties = elem.properties;

                // Create Label
                if (properties && properties.name) {
                    let center = properties.centroid || properties.center;
                    if (center) {
                        // Create a anchor mesh for the label
                        const anchor = MeshBuilder.CreateBox("anchor_" + properties.name, {size: 0.1}, this.scene);
                        anchor.position = new Vector3(center[0], 0, center[1]);
                        anchor.isVisible = false;
                        anchor.parent = this.mapGroup;

                        const label = new TextBlock();
                        label.text = properties.name;
                        label.color = "white";
                        label.fontSize = 12;
                        label.outlineWidth = 2;
                        label.outlineColor = "black";
                        
                        // Make label clickable
                        // label.isPointerBlocker = true;
                        
                        advancedTexture.addControl(label);
                        label.linkWithMesh(anchor);
                        label.linkOffsetY = 0; // Reset offset

                        // Add Light Pillar
                        const pillar = createLightPillar(center[0], center[1], 1.2, this.scene);
                        pillar.parent = this.mapGroup;
                        pillar.name = "pillar_" + properties.name;
                        this.lightPillars.push(pillar);
                    }
                }

                coordinates.forEach((multiPolygon) => {
                     multiPolygon.forEach((polygon) => {
                         // Polygon is array of [x, y]
                         const rawShape = [];
                         for(let pt of polygon) {
                             // Babylon XZ plane: x -> x, y -> z
                             rawShape.push(new Vector3(pt[0], 0, pt[1]));
                         }
                         
                         // Clean shape: remove duplicate consecutive points
                         const shape = [];
                         if (rawShape.length > 0) {
                             shape.push(rawShape[0]);
                             for (let i = 1; i < rawShape.length; i++) {
                                 if (!rawShape[i].equals(rawShape[i-1])) {
                                     shape.push(rawShape[i]);
                                 }
                             }
                             // Ensure closed loop? ExtrudePolygon usually handles it, but let's be safe.
                             // If last != first, push first?
                             // But ExtrudePolygon docs say "shape" is the contour. It closes it automatically.
                             // However, if strict match is needed for earcut...
                         }
                         
                         if (shape.length < 3) {
                            console.warn("Polygon has too few points:", properties.name);
                            return;
                         }
                         
                         try {
                             if (properties.name.includes("嘉峪关")) {
                                 console.log("Generating mesh for:", properties.name, "Shape points:", shape.length);
                             }
                             const mesh = MeshBuilder.ExtrudePolygon("polygon", {
                                 shape: shape,
                                 depth: 0.6,
                                  sideOrientation: Mesh.DOUBLESIDE,
                                  wrap: true
                              }, this.scene, earcutLib);
                              
                              mesh.material = mat;
                             mesh.parent = this.mapGroup;
                             mesh.isPickable = true; // Ensure map is pickable
                             mesh.metadata = { polygon: polygon, properties: properties }; // Store metadata for interaction
                             
                             if (properties.name.includes("嘉峪关")) {
                                 console.log("Mesh created for:", properties.name, "Vertices:", mesh.getTotalVertices());
                             }

                             // Exclude base map from glow layer
                             if (this.glowLayer) {
                                 this.glowLayer.addExcludedMesh(mesh);
                             }

                             // Add interaction
                             mesh.actionManager = new ActionManager(this.scene);
                             mesh.actionManager.registerAction(
                                 new ExecuteCodeAction(
                                     ActionManager.OnPickTrigger,
                                     () => {
                                        // 清除旧的光栏
                                        if (this.currentBorderMesh) {
                                            this.currentBorderMesh.dispose();
                                            this.currentBorderMesh = null;
                                        }

                                        // 如果点击的是当前已选中的 Mesh，则复原
                                        if (this.currentSelectedMesh === mesh) {
                                            // Restore all meshes to normal brightness
                                            this.mapGroup.getChildMeshes().forEach(m => {
                                                if (m.name === "polygon") {
                                                    m.material = mat;
                                                }
                                            });

                                            // Restore all pillars
                                            if (this.lightPillars) {
                                                this.lightPillars.forEach(p => p.setEnabled(true));
                                            }

                                            new TWEEN.Tween(this.currentSelectedMesh.position)
                                                .to({ y: 0 }, 300)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();
                                            this.currentSelectedMesh = null;
                                            return;
                                        }

                                        // 恢复上一个选中 Mesh 的状态
                                        if (this.currentSelectedMesh) {
                                             // This part is covered by the loop below which sets everything to dim
                                             // But we should animate the old one down first
                                            new TWEEN.Tween(this.currentSelectedMesh.position)
                                                .to({ y: 0 }, 300)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();
                                        }

                                        // Set all meshes to dim first
                                        this.mapGroup.getChildMeshes().forEach(m => {
                                            if (m.name === "polygon") {
                                                m.material = dimMat;
                                            }
                                        });

                                        // Handle light pillars visibility
                                        if (this.lightPillars) {
                                            this.lightPillars.forEach(p => {
                                                if (p.name === "pillar_" + properties.name) {
                                                    p.setEnabled(true);
                                                } else {
                                                    p.setEnabled(false);
                                                }
                                            });
                                        }

                                        // 设置当前 Mesh 为高亮状态
                                        this.currentSelectedMesh = mesh;
                                        mesh.material = highlightMat;
                                        
                                        // 使用 Tween 动画抬起
                                        new TWEEN.Tween(mesh.position)
                                            .to({ y: 0.2 }, 300) // 抬高 0.2 单位
                                            .easing(TWEEN.Easing.Quadratic.Out)
                                            .start();

                                        // Removed light barrier (光栏) creation as per user request
                                        
                                        // 摄像机推进逻辑
                                        if (properties.centroid || properties.center) {
                                            const centerArr = properties.centroid || properties.center;
                                            const targetPoint = new Vector3(centerArr[0], 0, centerArr[1]);
                                            
                                            // 1. 移动摄像机目标点 (Target)
                                            new TWEEN.Tween(this.camera.target)
                                                .to({ x: targetPoint.x, y: 0, z: targetPoint.z }, 1000)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();

                                            // 2. 推进摄像机距离 (Radius)
                                            // 设定一个合适的观察距离，例如 5-8 之间，视地市大小而定
                                            new TWEEN.Tween(this.camera)
                                                .to({ radius: 8, beta: Math.PI / 3 }, 1000) // 同时调整角度
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();
                                        } else {
                                            // 如果没有中心点数据，尝试使用包围盒中心
                                            const boundingInfo = mesh.getBoundingInfo();
                                            const centerWorld = boundingInfo.boundingBox.centerWorld;
                                            // 注意：centerWorld 包含了父级变换，但这里我们需要的是世界坐标
                                            // 由于 mesh 已经浮起，centerWorld.y 会变化，我们只取 x, z
                                            
                                            new TWEEN.Tween(this.camera.target)
                                                .to({ x: centerWorld.x, y: 0, z: centerWorld.z }, 1000)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();
                                                
                                            new TWEEN.Tween(this.camera)
                                                .to({ radius: 8, beta: Math.PI / 3 }, 1000)
                                                .easing(TWEEN.Easing.Quadratic.Out)
                                                .start();
                                        }
                                        
                                        console.log("Clicked:", properties.name);
                                    }
                                 )
                             );
                         } catch (err) {
                             console.error("ExtrudePolygon failed for:", properties.name, err);
                         }
                         
                         // Lift it slightly so it sits on "ground" 0 to 0.2
                         // Actually ExtrudePolygon builds up?
                         // Let's assume it's fine.
                     });
                });
            });
            
            this.initBorderLine(provinceData, this.mapGroup);
             
             // Calculate bounds
             const { size, center, min, max } = getBoundingBox(this.mapGroup);

             // --- 全局 UV 映射逻辑 ---
             // 遍历所有地市 Mesh，将其 UV 坐标重映射到整个浙江省的 BoundingBox
             // 这样一张覆盖全省的卫星图就能无缝贴合到所有碎裂的 Mesh 上
             const widthGlobal = max.x - min.x;
             const heightGlobal = max.z - min.z;

             this.mapGroup.getChildMeshes().forEach(mesh => {
                 // 只处理地市模型 (名字为 "polygon")
                 if (mesh.name === "polygon") {
                     const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
                     const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
                     
                     if (positions && uvs) {
                         for (let i = 0; i < positions.length; i += 3) {
                             const x = positions[i];
                             const z = positions[i + 2]; // Babylon中 y向上，z是地理纬度方向
                             
                             // 计算归一化 UV 坐标
                             // u: 经度方向 (x)
                             const u = (x - min.x) / widthGlobal;
                             // v: 纬度方向 (z)
                             const v = (z - min.z) / heightGlobal;
                             
                             const uvIndex = (i / 3) * 2;
                             uvs[uvIndex] = u;
                             uvs[uvIndex + 1] = v;
                         }
                         // 更新 Mesh 的 UV 数据
                         mesh.setVerticesData(VertexBuffer.UVKind, uvs);
                     }
                 }
             });
             // -----------------------

             centerXY = [center.x, center.z];
             let width = size.x < size.z ? size.z + 1 : size.x + 1;
             
             this.initDecorations(width);
         }

         initDecorations(width) {
             const center = new Vector3(centerXY[0], 0, centerXY[1]);
             
             // Rotating Aperture
             const apertureTex = new Texture("/data/map/rotatingAperture.png", this.scene);
             apertureTex.hasAlpha = true;
             const apertureMat = new StandardMaterial("apertureMat", this.scene);
             apertureMat.diffuseTexture = apertureTex;
             apertureMat.useAlphaFromDiffuseTexture = true;
             apertureMat.opacityTexture = apertureTex;
             apertureMat.backFaceCulling = false;
             apertureMat.emissiveColor = Color3.FromHexString("#00AAAA"); // Cyan tint
             apertureMat.disableLighting = true;
             apertureMat.alpha = 1.0; // Ensure 100% opacity
            
            this.rotatingApertureMesh = MeshBuilder.CreateGround("aperture", { width: width * 1.1, height: width * 1.1 }, this.scene);
            this.rotatingApertureMesh.position = center.clone();
            this.rotatingApertureMesh.position.y = 0;
            this.rotatingApertureMesh.material = apertureMat;
            this.rotatingApertureMesh.isPickable = false; // Prevent blocking clicks
            
            // Rotating Point
            const pointTex = new Texture("/data/map/rotating-point2.png", this.scene);
            pointTex.hasAlpha = true;
            const pointMat = new StandardMaterial("pointMat", this.scene);
            pointMat.diffuseTexture = pointTex;
            pointMat.useAlphaFromDiffuseTexture = true;
            pointMat.opacityTexture = pointTex;
            pointMat.emissiveColor = Color3.FromHexString("#008888"); // Teal tint
            pointMat.disableLighting = true;
            pointMat.alpha = 1.0; // Ensure 100% opacity
            
            this.rotatingPointMeshes = [];
            for (let i = 0; i < 3; i++) {
                const mesh = MeshBuilder.CreateGround("point_" + i, { width: width * 1.1, height: width * 1.1 }, this.scene);
                mesh.position = center.clone();
                // Slight offset to prevent z-fighting if they are opaque-ish
                mesh.position.y = -0.22 - (i * 0.001); 
                mesh.material = pointMat;
                mesh.isPickable = false;
                this.rotatingPointMeshes.push(mesh);
            }

            // Init Rising Particles
            const { initParticles } = useRisingParticles(this.scene);
            initParticles(center, width);
            
            // Scene Bg
            const bgTex = new Texture("/data/map/scene-bg2.png", this.scene);
            bgTex.hasAlpha = true;
            const bgMat = new StandardMaterial("bgMat", this.scene);
            bgMat.diffuseTexture = bgTex;
            bgMat.useAlphaFromDiffuseTexture = true;
            bgMat.opacityTexture = bgTex;
            bgMat.emissiveColor = Color3.FromHexString("#051111"); // Very dark background
            bgMat.disableLighting = true;
             
             const bgMesh = MeshBuilder.CreateGround("bg", { width: width * 4, height: width * 4 }, this.scene);
             bgMesh.position = center.clone();
             bgMesh.position.y = -0.4;
             bgMesh.material = bgMat;
             bgMesh.isPickable = false;
             
             // Circle Point
             const circleTex = new Texture("/data/map/circle-point.png", this.scene);
             circleTex.hasAlpha = true;
             const circleMat = new StandardMaterial("circleMat", this.scene);
             circleMat.diffuseTexture = circleTex;
             circleMat.useAlphaFromDiffuseTexture = true;
             circleMat.opacityTexture = circleTex;
             circleMat.emissiveColor = Color3.FromHexString("#00ffff");
             circleMat.disableLighting = true;
             
             const circleMesh = MeshBuilder.CreateGround("circle", { width: width, height: width }, this.scene);
             circleMesh.position = center.clone();
             circleMesh.position.y = -0.3;
             circleMesh.material = circleMat;
             circleMesh.isPickable = false;

             // Animation loop
             this.scene.registerBeforeRender(() => {
                 TWEEN.update();
                 
                 // Update stats
                 if (showStats.value && this.camera) {
                     cameraStats.x = this.camera.position.x.toFixed(2);
                     cameraStats.y = this.camera.position.y.toFixed(2);
                     cameraStats.z = this.camera.position.z.toFixed(2);
                     cameraStats.alpha = this.camera.alpha.toFixed(2);
                     cameraStats.beta = this.camera.beta.toFixed(2);
                     cameraStats.radius = this.camera.radius.toFixed(2);
                     if (this.camera.target) {
                         cameraStats.targetX = this.camera.target.x.toFixed(2);
                         cameraStats.targetY = this.camera.target.y.toFixed(2);
                         cameraStats.targetZ = this.camera.target.z.toFixed(2);
                     }
                 }
                 
                 if (this.rotatingApertureMesh) {
                     this.rotatingApertureMesh.rotation.y += 0.0005;
                 }
                 if (this.rotatingPointMeshes) {
                     this.rotatingPointMeshes.forEach(mesh => {
                         mesh.rotation.y -= 0.0005;
                     });
                 }

                 // Adaptive scaling for light pillars
                 if (this.lightPillars && this.lightPillars.length > 0 && this.camera) {
                     // Base radius ~8-10. Max ~100.
                     // We want scale 1 at radius 8, scale < 1 as radius increases.
                     // Formula: scale = base / (radius * factor)?
                     // Simple linear clamp:
                     // 1.5 is base size.
                     // Let's scale the TransformNode.
                     
                     let scaleFactor = 1.0;
                     if (this.camera.radius > 8) {
                        scaleFactor = 8 / this.camera.radius; 
                        // If radius 16, scale 0.5. If radius 32, scale 0.25.
                        // Clamp to minimum visibility
                        scaleFactor = Math.max(scaleFactor, 0.3);
                     } else {
                        // Near view: shrink as we get closer
                        // At radius 8, scale = 1.0. As radius decreases, scale decreases.
                        // Minimum scale 0.2 (20%)
                        scaleFactor = this.camera.radius / 8.0;
                        scaleFactor = Math.max(scaleFactor, 0.2);
                     }
                     
                     this.lightPillars.forEach(p => {
                         p.scaling.setAll(scaleFactor);
                     });
                 }
             });
         }

         initBorderLine(data, mapGroup) {
          // Top line - Bright Cyan/White
          let lineTop = createCountryFlatLine(
            data,
            {
              color: 0xFFFFFF, // White
            },
            this.scene
          )
          lineTop.position.y = 0.03 // Set to 0.03 as requested
          lineTop.parent = mapGroup
          lineTop.renderingGroupId = 1;

          // Bottom line - Darker Cyan
          let lineBottom = createCountryFlatLine(
            data,
            {
              color: 0x008888,
            },
            this.scene
          )
          lineBottom.position.y = 0.05 
          lineBottom.parent = mapGroup
        }
      }

      baseMap = new CurrentMap3d({
        container: "#app-32-map",
        axesVisibel: false,
        bgColor: "#000000",
        controls: {
          visibel: true,
          enableDamping: true, 
        },
      })
      
      try {
          console.log("Starting initModel...");
          baseMap.initModel();
          console.log("initModel completed.");
      } catch (e) {
          console.error("Error in initModel:", e);
      }
      
      baseMap.run();
      window.addEventListener("resize", resize)
    })

    onBeforeUnmount(() => {
      window.removeEventListener("resize", resize)
    })

    return {
      cameraStats,
      showStats
    }
  },
}
</script>
<style>
html,
body,
#app,
.is-full {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.camera-stats-ui {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: rgba(0, 0, 0, 0.6);
  color: #00ff00;
  padding: 10px;
  border-radius: 4px;
  pointer-events: none;
  font-family: monospace;
  font-size: 14px;
  z-index: 1000;
  border: 1px solid #00ff00;
}
.stats-toggle-btn {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  color: #00ff00;
  border: 1px solid #00ff00;
  padding: 8px 16px;
  cursor: pointer;
  z-index: 1000;
  font-family: monospace;
  border-radius: 4px;
}
.stats-toggle-btn:hover {
  background-color: rgba(0, 50, 0, 0.8);
}
</style>
