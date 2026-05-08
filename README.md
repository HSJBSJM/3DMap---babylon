# 浙江省 3D 可视化地图

基于 **Vue 3 + Babylon.js** 构建的浙江省 3D 可视化地图组件，采用暗黑科技风视觉风格。

## 技术栈

| 模块 | 技术选型 |
|------|----------|
| 核心框架 | Vue 3 (Composition API) |
| 构建工具 | Vite 4 |
| 3D 引擎 | Babylon.js 8.x |
| 动画引擎 | Tween.js |
| 几何计算 | Earcut |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务
npm run dev

# 生产打包
npm run build
```

访问 `http://localhost:5173` 查看效果。

## 项目结构

```
src/
├── App.vue                        # 主组件：地图初始化、渲染、交互
├── utils/
│   └── Map3d.js                   # Map3d 基类（引擎、场景、摄像机）
├── hooks/
│   ├── useFileLoader.js           # 文件加载
│   ├── useConversionStandardData.js # GeoJSON 数据标准化
│   ├── useCoord.js                # 坐标转换（墨卡托、球面）
│   ├── useCountry.js              # 省界线绘制
│   └── map/
│       ├── useMapMarkedLightPillar.js # 光柱标记
│       └── useRisingParticles.js      # 上升粒子
public/data/map/
├── 浙江省.geojson                 # 浙江省 GeoJSON 数据
├── 浙江省.svg                     # 浙江省轮廓 SVG
├── 中华人民共和国.json            # 全国边界数据
└── *.png / *.jpg                  # 纹理贴图资源
```

## 摄像机配置

摄像机参数可在 `src/App.vue` 的 `initCamera()` 方法中调整：

```javascript
this.camera.setPosition(new Vector3(120.98, 4.23, 23.13));
this.camera.setTarget(new Vector3(120.64, -0.58, 28.96));
this.camera.alpha = -1.51;
this.camera.beta = 0.88;
this.camera.radius = 7.57;
```

屏幕右上角实时显示摄像机调试参数，底部按钮可切换显隐。

## 地图贴图替换

地图纹理使用全局 UV 映射，将一张完整图片均匀贴合到所有地市 Mesh 上。替换步骤：

1. 准备一张浙江省的卫星图/风格图，确保图片边缘对齐浙江的**最小外接矩形**
2. 将图片放入 `public/data/map/`
3. 修改 `src/App.vue` 中纹理路径：
   ```javascript
   const textureMap = new Texture("/data/map/your-image.jpg", this.scene);
   ```

## 交互功能

- **点击地市** → 地块抬升 + 高亮辉光 + 相机自动运镜
- **再次点击** → 状态复原
- **选中状态** → 未选中区域自动暗化，光柱智能显隐
- **光柱自适应** → 根据摄像机距离自动缩放

## 数据更新

替换 `public/data/map/浙江省.geojson` 并修改 `App.vue` 中加载路径，即可渲染不同省份/区域。

## 许可证

MIT
