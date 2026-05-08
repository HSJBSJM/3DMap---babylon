import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Color4,
  Color3,
  AxesViewer
} from "@babylonjs/core";
import "@babylonjs/loaders";
import { deepMerge } from "@/utils";
import TWEEN from "@tweenjs/tween.js";

export default class Map3d {
  constructor(options = {}) {
    let defaultOptions = {
      isFull: true,
      container: null,
      width: window.innerWidth,
      height: window.innerHeight,
      bgColor: "#000000",
      materialColor: "#ff0000",
      controls: {
        visibel: true, // 是否开启
        enableDamping: true, // 阻尼
        autoRotate: false, // 自动旋转
        maxPolarAngle: Math.PI, // 相机垂直旋转角度的上限
      },
      statsVisibel: true,
      axesVisibel: true,
      axesHelperSize: 250, // 左边尺寸
    };
    this.options = deepMerge(defaultOptions, options);
    this.container = document.querySelector(this.options.container);
    
    // Check if container exists
    if (!this.container) {
      console.error("Container not found");
      return;
    }

    this.options.width = this.container.offsetWidth;
    this.options.height = this.container.offsetHeight;
    
    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.id = "renderCanvas";
    this.container.appendChild(this.canvas);

    this.engine = null;
    this.scene = null;
    this.camera = null;
    
    this.init();
  }

  init() {
    this.initEngine();
    this.initScene();
    this.initCamera();
    this.initLight();
    if (this.options.axesVisibel) {
      this.initAxes();
    }
    
    // Resize event
    window.addEventListener("resize", () => {
      this.resize();
    });
  }

  initEngine() {
    this.engine = new Engine(this.canvas, true);
  }

  initScene() {
    this.scene = new Scene(this.engine);
    // Set background color
    if (this.options.bgColor) {
      this.scene.clearColor = Color4.FromHexString(this.options.bgColor + "FF");
    }
  }

  initCamera() {
    // Equivalent to PerspectiveCamera(45, rate, 0.1, 1500)
    // Babylon uses radians for FOV. 45 degrees is approx 0.785 radians.
    // Position: (270.27, 173.24, 257.54)
    // Target: (0, 0, 0)
    
    this.camera = new ArcRotateCamera(
      "camera1",
      0,
      0,
      1000,
      Vector3.Zero(),
      this.scene
    );
    
    this.camera.setPosition(new Vector3(270.27, 173.24, 257.54));
    
    if (this.options.controls.visibel) {
      this.camera.attachControl(this.canvas, true);
    }
    
    // Adjust clipping planes to match Three.js settings (0.1, 1500)
    this.camera.minZ = 0.1;
    this.camera.maxZ = 3000; // Increased a bit to be safe
  }

  initLight() {
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.7;
  }

  initAxes() {
    new AxesViewer(this.scene, this.options.axesHelperSize);
  }

  resize() {
    if (this.engine) {
      this.engine.resize();
    }
  }

  run() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
      TWEEN.update();
    });
  }
}
