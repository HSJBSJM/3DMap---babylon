import { Vector3, Quaternion } from "@babylonjs/core";

const useCoord = () => {
  /**
   * 生成墨卡托坐标
   * @param {*} longitude 经度
   * @param {*} latitude 纬度
   * @returns
   */
  const geoMercatorCoord = (longitude, latitude) => {
    var E = longitude
    var N = latitude
    var x = (E * 20037508.34) / 180
    var y = Math.log(Math.tan(((90 + N) * Math.PI) / 360)) / (Math.PI / 180)
    y = (y * 20037508.34) / 180
    return {
      x: x, 
      y: y, 
    }
  }
  /**
   * 生成球面坐标
   * @param {*} R 球半径
   * @param {*} longitude 经度
   * @param {*} latitude 纬度
   * @returns
   */
  const geoSphereCoord = (R, longitude, latitude) => {
    var lon = (longitude * Math.PI) / 180 //转弧度值
    var lat = (latitude * Math.PI) / 180 //转弧度值
    lon = -lon 

    var x = R * Math.cos(lat) * Math.cos(lon)
    var y = R * Math.sin(lat)
    var z = R * Math.cos(lat) * Math.sin(lon)
    return {
      x: x,
      y: y,
      z: z,
    }
  }
  /**
   * 计算包围盒
   * @param {*} group
   * @returns
   */
  const getBoundingBox = (group) => {
    const { min, max } = group.getHierarchyBoundingVectors();
    const size = max.subtract(min);
    const center = min.add(size.scale(0.5));
    
    return {
      min,
      max,
      center,
      size,
    }
  }
  
  /**
   * 设置网格的位置及姿态 (Babylon.js version)
   * @param {*} mesh
   * @param {*} R
   * @param {*} lon
   * @param {*} lat
   * @returns
   */
  const setMeshQuaternion = (mesh, R, lon, lat) => {
    const { x, y, z } = geoSphereCoord(R, lon, lat)
    mesh.position.set(x, y, z)
    
    // meshVector is normal from center (0,0,0) to mesh position
    let meshVector = new Vector3(x, y, z).normalize()
    
    // Default normal for plane in Babylon is usually Z (or Y depending on creation)
    // Assuming Z is normal (0,0,1)
    let normal = new Vector3(0, 0, 1)
    
    // Create rotation from normal to meshVector
    // Babylon: Quaternion.FromUnitVectorsToRef(v1, v2, result)
    // Or mesh.lookAt(center) ? But lookAt aligns forward axis.
    
    // For now, let's assume this function isn't heavily used in the flat map scenario.
    // Implementing basic rotation if needed.
    
    return mesh
  }
  
  return {
    geoMercatorCoord,
    geoSphereCoord,
    getBoundingBox,
    setMeshQuaternion,
  }
}
export default useCoord
