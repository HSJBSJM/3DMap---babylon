import { 
    Vector3, 
    Color3, 
    MeshBuilder, 
    StandardMaterial, 
    Texture, 
    TransformNode
} from "@babylonjs/core";
import { deepMerge, random } from "@/utils";
import TWEEN from "@tweenjs/tween.js";

export default function useMarkedLightPillar(options) {
  let defaultOptions = {
    pointTextureUrl: "./assets/texture/标注.png",
    lightHaloTextureUrl: "./assets/texture/标注光圈.png",
    lightPillarUrl: "./assets/texture/光柱.png",
    scaleFactor: 1, 
  };
  defaultOptions = deepMerge(defaultOptions, options);

  const createLightPillar = (lon, lat, heightScaleFactor = 1, scene) => {
      const group = new TransformNode("lightPillarGroup", scene);
      group.position.set(lon, 0, lat); // Map is XZ

      const height = heightScaleFactor;
      const width = height / 6.219;
      
      // Material for pillar
      const pillarMat = new StandardMaterial("pillarMat", scene);
      const pillarTex = new Texture(defaultOptions.lightPillarUrl, scene);
      pillarTex.hasAlpha = true;
      pillarMat.diffuseTexture = pillarTex;
      pillarMat.useAlphaFromDiffuseTexture = true;
      pillarMat.opacityTexture = pillarTex;
      pillarMat.emissiveColor = Color3.FromHexString("#00ffff");
      pillarMat.disableLighting = true;
      pillarMat.backFaceCulling = false;

      // Pillar 1 (Vertical plane)
      const p1 = MeshBuilder.CreatePlane("p1", { width: width, height: height }, scene);
      p1.material = pillarMat;
      p1.position.y = height / 2; // Center is at 0, move up
      p1.parent = group;
      p1.rotation.y = 0;
      p1.isPickable = false;
      // Billboard mode? If we want it to face camera always?
      // Original code rotated one 90 deg, so it forms a cross.
      
      // Pillar 2
      const p2 = p1.clone("p2");
      p2.rotation.y = Math.PI / 2;
      p2.parent = group;
      p2.isPickable = false;
      
      // Bottom Point (on ground)
      const pointMat = new StandardMaterial("pointMat", scene);
      const pointTex = new Texture(defaultOptions.pointTextureUrl, scene);
      pointTex.hasAlpha = true;
      pointMat.diffuseTexture = pointTex;
      pointMat.useAlphaFromDiffuseTexture = true;
      pointMat.opacityTexture = pointTex;
      pointMat.emissiveColor = Color3.FromHexString("#00ffff");
      pointMat.disableLighting = true;
      
      const pointMesh = MeshBuilder.CreateGround("point", { width: 1, height: 1 }, scene);
      pointMesh.material = pointMat;
      const scale = 0.15 * defaultOptions.scaleFactor;
      pointMesh.scaling.set(scale, scale, scale);
      pointMesh.position.y = 0.21; // Just above map (0.2)
      pointMesh.parent = group;
      pointMesh.isPickable = false;
      
      // Halo (animated)
      const haloMat = new StandardMaterial("haloMat", scene);
      const haloTex = new Texture(defaultOptions.lightHaloTextureUrl, scene);
      haloTex.hasAlpha = true;
      haloMat.diffuseTexture = haloTex;
      haloMat.useAlphaFromDiffuseTexture = true;
      haloMat.opacityTexture = haloTex;
      haloMat.emissiveColor = Color3.FromHexString("#00ffff");
      haloMat.disableLighting = true;
      haloMat.alpha = 0;
      
      const haloMesh = MeshBuilder.CreateGround("halo", { width: 1, height: 1 }, scene);
      haloMesh.material = haloMat;
      const haloScale = 0.3 * defaultOptions.scaleFactor;
      haloMesh.scaling.set(haloScale, haloScale, haloScale);
      haloMesh.position.y = 0.22; // Slightly above point
      haloMesh.parent = group;
      haloMesh.isPickable = false;
      
      // Animation using Tween (as per original)
      const delay = random(0, 2000);
      const t1 = new TWEEN.Tween({ s: haloScale, o: 0 })
          .to({ s: haloScale * 1.5, o: 1 }, 1000)
          .delay(delay)
          .onUpdate((obj) => {
              haloMesh.scaling.set(obj.s, obj.s, obj.s);
              haloMat.alpha = obj.o;
          });
          
      const t2 = new TWEEN.Tween({ s: haloScale * 1.5, o: 1 })
          .to({ s: haloScale * 2, o: 0 }, 1000)
          .onUpdate((obj) => {
              haloMesh.scaling.set(obj.s, obj.s, obj.s);
              haloMat.alpha = obj.o;
          });
          
      t1.chain(t2);
      t2.chain(t1);
      t1.start();

      return group;
  }
  
  return { createLightPillar };
}
