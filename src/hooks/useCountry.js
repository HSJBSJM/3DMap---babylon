import { Vector3, Color3, MeshBuilder, TransformNode } from "@babylonjs/core";
import { deepMerge } from "@/utils";

const useCountryLine = () => {
  /**
   * 创建国家平面边线
   * @param {*} data 数据
   * @param {*} materialOptions 材质参数
   * @param {*} scene Babylon Scene
   * @returns
   */
  const createCountryFlatLine = (data, materialOptions = {}, scene) => {
    let materialOpt = {
      color: 0x00ffff,
    };
    materialOpt = deepMerge(materialOpt, materialOptions);
    
    // Convert hex color to Color3
    let color = Color3.FromHexString("#" + materialOpt.color.toString(16).padStart(6, '0'));
    // If input is number like 0x00ffff
    if (typeof materialOpt.color === 'number') {
        const r = (materialOpt.color >> 16 & 255) / 255;
        const g = (materialOpt.color >> 8 & 255) / 255;
        const b = (materialOpt.color & 255) / 255;
        color = new Color3(r, g, b);
    }

    const features = data.features;
    const lineGroup = new TransformNode("lineGroup", scene);

    features.forEach((element) => {
      element.geometry.coordinates.forEach((coords) => {
        // coords[0] is usually the outer ring
        if (!coords[0]) return;
        
        // Handle MultiPolygon vs Polygon structure differences if necessary
        // In GeoJSON: 
        // Polygon: [ [ [x,y], ... ] ] -> coords is [ [x,y]... ]
        // MultiPolygon: [ [ [ [x,y]... ] ] ] -> coords is [ [ [x,y]... ] ]
        // The original code iterates: element.geometry.coordinates.forEach
        // If it's MultiPolygon, coordinates is Array of Polygons.
        // If it's Polygon, coordinates is Array of LinearRings.
        
        // Original code:
        // element.geometry.coordinates.forEach((coords, idx) => {
        //    coords[0].forEach...
        // })
        // This implies `element.geometry.coordinates` is a list of Polygons (MultiPolygon).
        // And `coords` is a Polygon (list of rings). `coords[0]` is the outer ring.
        
        const points = [];
        coords[0].forEach((item) => {
           // GeoJSON (long, lat) -> Babylon (x, z)
           // Z-up in original -> Y-up in Babylon (height)
           // So we put it at y=0 (or slightly higher to avoid z-fighting)
           points.push(new Vector3(item[0], 0, item[1]));
        });

        const line = MeshBuilder.CreateLines("countryLine", {
            points: points,
            updatable: false
        }, scene);
        
        line.color = color;
        line.parent = lineGroup;
      });
    });

    return lineGroup;
  };

  return {
    createCountryFlatLine,
  };
};

export default useCountryLine;
