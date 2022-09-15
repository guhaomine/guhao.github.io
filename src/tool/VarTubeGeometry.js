// import * as THREE from './node_modules/three/build/three.js';
import * as THREE from '../three/three.module.js';
/**
 * @author icecream
 * @version 2.0.0
 * @description 绘制变径管道 curve, radiusArr, 20, valuesArr, mapValuesArr, LUT
 * @param curve <CatmullRomCurve3>  轨迹
 * @param radiusArr <Array> [['井深'<Number>,'半径'<Number>]...] 半径数组,
 * @param radialSegments <Number> 管道截面分段数
 * @param valuesArr <Array> ['值域最小值'<Number>,'值域最大值'<Number>] 半径值域,
 * @param mapValuesArr <Array>  ['映射最小值'<Number>,'映射最大值'<Number>] 半径值域映射
 * @param LUT <Lut> 根据半径给顶点上色
 */
 class VarTubeGeometry extends THREE.BufferGeometry {
    constructor(
      path,
      radiusArr,
      radialSegments = 8,
      valuesArr,
      mapValuesArr,
      lut
    ) {
      super();
      const tubularSegments = radiusArr.length - 1;
      const wellLength = path.getLength();
      this.type = 'VarTubeGeometry';
      this.parameters = {
        lut: lut,
        path: path,
        tubularSegments: tubularSegments,
        radialSegments: radialSegments,
        closed: closed
      };
      const frames = computeFrenetFrames(path, radiusArr); // expose internals
  
      this.tangents = frames.tangents;
      this.normals = frames.normals;
      this.binormals = frames.binormals; // helper variables
  
      const vertex = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const uv = new THREE.Vector2();
      let P = new THREE.Vector3(); // buffer
  
      const vertices = [];
      const normals = [];
      const uvs = [];
      const colors = [];
      const indices = []; // create buffer data
  
      generateBufferData(); // build geometry
      this.setIndex(indices);
      this.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      this.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      this.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); // functions
      this.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  
      function generateBufferData() {
        for (let i = 0; i <= tubularSegments; i++) {
          generateSegment(i, radiusArr[i]);
        } // if the geometry is not closed, generate the last row of vertices and normals
  
        generateUVs(); // finally create faces
  
        generateIndices();
      }
  
      function generateSegment(i, arr) {
        // we use getPointAt to sample evenly distributed points from the given path
        P = path.getPointAt(arr[0] / wellLength, P); // retrieve corresponding normal and binormal
        const radius = THREE.Math.mapLinear(
          arr[1],
          valuesArr[0],
          valuesArr[1],
          mapValuesArr[0],
          mapValuesArr[1]
        );
        const N = frames.normals[i];
        const B = frames.binormals[i]; // generate normals and vertices for the current segment
        var color = null;
        if (lut) {
          color = lut.getColor(arr[1]);
        }
        for (let j = 0; j <= radialSegments; j++) {
          const v = (j / radialSegments) * Math.PI * 2;
          const sin = Math.sin(v);
          const cos = -Math.cos(v); // normal
  
          normal.x = cos * N.x + sin * B.x;
          normal.y = cos * N.y + sin * B.y;
          normal.z = cos * N.z + sin * B.z;
          normal.normalize();
          normals.push(normal.x, normal.y, normal.z); // vertex
  
          if (color) {
            colors.push(color.r, color.g, color.b);
          }
  
          vertex.x = P.x + radius * normal.x;
          vertex.y = P.y + radius * normal.y;
          vertex.z = P.z + radius * normal.z;
          vertices.push(vertex.x, vertex.y, vertex.z);
        }
      }
  
      function generateIndices() {
        for (let j = 1; j <= tubularSegments; j++) {
          for (let i = 1; i <= radialSegments; i++) {
            const a = (radialSegments + 1) * (j - 1) + (i - 1);
            const b = (radialSegments + 1) * j + (i - 1);
            const c = (radialSegments + 1) * j + i;
            const d = (radialSegments + 1) * (j - 1) + i; // faces
  
            indices.push(a, b, d);
            indices.push(b, c, d);
          }
        }
      }
  
      function computeFrenetFrames(curve, arrRadius) {
        // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf
        const normal = new THREE.Vector3();
        const tangents = [];
        const seg = radiusArr.length - 1;
        const normals = [];
        const binormals = [];
        const vec = new THREE.Vector3();
        const mat = new THREE.Matrix4(); // compute the tangent vectors for each segment on the curve
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        for (let i = 0; i < arrRadius.length; i++) {
          const u = arrRadius[i][0] / wellLength;
          tangents[i] = curve.getTangentAt(u, new THREE.Vector3());
          tangents[i].normalize();
        } // select an initial normal vector perpendicular to the first tangent vector,
        // and in the direction of the minimum tangent xyz component
  
        normals[0] = new THREE.Vector3();
        binormals[0] = new THREE.Vector3();
        let min = Number.MAX_VALUE;
        const tx = Math.abs(tangents[0].x);
        const ty = Math.abs(tangents[0].y);
        const tz = Math.abs(tangents[0].z);
  
        if (tx <= min) {
          min = tx;
          normal.set(1, 0, 0);
        }
  
        if (ty <= min) {
          min = ty;
          normal.set(0, 1, 0);
        }
  
        if (tz <= min) {
          normal.set(0, 0, 1);
        }
  
        vec.crossVectors(tangents[0], normal).normalize();
        normals[0].crossVectors(tangents[0], vec);
        binormals[0].crossVectors(tangents[0], normals[0]); // compute the slowly-varying normal and binormal vectors for each segment on the curve
  
        for (let i = 1; i <= seg; i++) {
          normals[i] = normals[i - 1].clone();
          binormals[i] = binormals[i - 1].clone();
          vec.crossVectors(tangents[i - 1], tangents[i]);
  
          if (vec.length() > Number.EPSILON) {
            vec.normalize();
            const theta = Math.acos(
              clamp(tangents[i - 1].dot(tangents[i]), -1, 1)
            ); // clamp for floating pt errors
  
            normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
          }
  
          binormals[i].crossVectors(tangents[i], normals[i]);
        } // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same
  
        return {
          tangents: tangents,
          normals: normals,
          binormals: binormals
        };
      }
  
      function generateUVs() {
        for (let i = 0; i <= tubularSegments; i++) {
          for (let j = 0; j <= radialSegments; j++) {
            uv.x = i / tubularSegments;
            uv.y = j / radialSegments;
            uvs.push(uv.x, uv.y);
          }
        }
      }
    }
  }
    
  /**
   * @author guhao
   * @updateDate 2021/12/20 优化了代码，减少重复代码量，修改了参数配置。
   * @param {*} config
   * @param {*} option
   */
  function Box3Grid(option) {
    this.type = 'Box3Grid';
    this.Root = new THREE.Group();
    this.Root.name = 'Box3Grid';
    this.option = Object.assign(
      {
        minRange: new THREE.Vector3(-500, -500, -500),
        maxRange: new THREE.Vector3(500, 500, 500),
        fontSize: 50,
        lineWidth: 2,
        scale: 100,
        fontColor: new THREE.Color(0, 0, 0),
        xName: 'X',
        yName: 'Y',
        zName: 'Z'
      },
      option || {}
    );
    this.TEXTS = {};
    this.direction = new THREE.Vector3();
    this.init();
  }
  Object.assign(Box3Grid.prototype, {
    init() {
      const getXYZarea = (min, max) => {
        return {
          area: [max.x - min.x, max.y - min.y, max.z - min.z],
          position: [
            (max.x + min.x) / 2,
            (max.y + min.y) / 2,
            (max.z + min.z) / 2
          ]
        };
      };
      const { maxRange, minRange } = this.option;
      const { area, position } = getXYZarea(minRange, maxRange);
      this.area = area;
      this.position = position;
      this.Root.add(this.drawBox());
      this.setTexts();
    },
    displayText(option) {
      const {
        text,
        size,
        position,
        anisotropy,
        color,
        width,
        height
      } = Object.assign(
        {
          text: 'text',
          size: 4,
          position: new THREE.Vector3(),
          color: new THREE.Float32BufferAttribute(0x0000ff)
        },
        option
      );
      var texture = new THREE.CanvasTexture(
        this.generateSprite({
          text,
          color: color.getStyle(),
          width,
          height
        })
      );
      if (anisotropy) {
        texture.anisotropy = anisotropy;
      }
      var _text = new THREE.Sprite(
        new THREE.SpriteMaterial({
          // transparent:true,
          depthWrite: false,
          map: texture,
        })
      );
      _text.position.set(position.x, position.y, position.z);
      if (width && height) {
        _text.scale.set((width / height) * size, size);
      } else {
        _text.scale.set(size, size);
      }
      return _text;
    },
    generateSprite(config) {
      const option = Object.assign(
        {
          text: 'text',
          color: '#000000',
          width: 64,
          height: 64,
          fontSize: 14
        },
        config || {}
      );
      var canvas = document.createElement('canvas');
      var w = option.width;
      var h = option.height;
      var size = h - 4;
      canvas.width = w;
      canvas.height = h;
      var context = canvas.getContext('2d');
      // context.fillStyle = '#ff0000';
      // context.fillRect(0, 0, w, h);
      context.beginPath();
      context.font = h + 'px Arial,Helvetica,sans-serif';
      context.textAlign = 'center';
      context.fillStyle = option.color;
      var left = w / 2;
      var top = size - 2;
      context.fillText(option.text, left, top);
      // context.fill();
      // context.stroke();
      return canvas;
    },
    drawBox() {
      const { area, position } = this;
      var box3 = new THREE.BoxBufferGeometry(...area);
      var uvs = [
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        0,
        1,
        1,
        0,
        1,
        1,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        0,
        0,
        1,
        0
      ];
      box3.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      //material2
      const { maxRange: max } = this.option;
      var getLevel = () => {
        var M = Math.max(...area);
        var level = Math.floor(Math.log10(M));
        var diff = 3 - level;
        return Math.pow(10, diff);
      };
      var level = getLevel();
      var materialArr = [
        [area[2], area[1], max.z, max.y],
        [area[2], area[1], max.z, max.y],
        [area[0], area[2], max.x, max.z],
        [area[0], area[2], max.x, max.z],
        [area[0], area[1], max.x, max.y],
        [area[0], area[1], max.x, max.y]
      ].map(arr => {
        return new THREE.MeshBasicMaterial({
          // reflectivity: 0.1, // 反射率
          // specular: 0x888888, // 设置高亮颜色，缺省为 0x111111 .
          // shininess: 100, // 设置亮度，缺省为 30.
          // emissive: 0xff0000, // 设置放射光颜色。默认是0x000000.
          // color: 0xff0000,
          // aoMapIntensity:0,
          // blendDstAlpha:1,
          // blendEquationAlpha:0.8,
          // fog:false,
          side: THREE.BackSide,
          depthWrite: false,
          // refractionRatio:0.9,
          // blending: SubtractiveBlending,
          transparent: true,
          map: this.getGridLineTexture(
            arr[0] * level,
            arr[1] * level,
            arr[2] * level,
            arr[3] * level,
            this.option.scale * level
          )
        });
      });
      var mesh = new THREE.Mesh(box3, materialArr);
      mesh.name = 'gridBox';
      mesh.position.set(...position);
      return mesh;
    },
    setTexts() {
      const {
        minRange,
        maxRange,
        anisotropy,
        fontColor: color,
        scale,
        fontSize,
        textFormat
      } = this.option;
      const position = this.position;
      const offset = fontSize / 2;
      const nameOffset = fontSize;
      const nameWidth = 64 * 5;
      const nameHeight = 64;
      const _V = new THREE.Vector3();
      var drawXYZ = (min, max, type) => {
        const G = new THREE.Group();
        var start = Math.floor(max / scale) * scale;
        var _p = new THREE.Vector3(0, 0, 0);
        while (start > min) {
          if (start !== max) {
            const _text =
              typeof textFormat === 'function' ? textFormat(start, type) : start;
            _p[type] = start;
            G.add(
              this.displayText({
                text: _text,
                position: _p,
                width: nameHeight * 5,
                height: nameHeight,
                anisotropy,
                size: fontSize,
                color
              })
            );
          }
          start -= scale;
        }
        return G;
      };
  
      const xText = drawXYZ(minRange.x, maxRange.x, 'x');
      const yText = drawXYZ(minRange.y, maxRange.y, 'y');
      const zText = drawXYZ(minRange.z, maxRange.z, 'z');
      const xPositon = [
        [0, '-', '-'],
        [0, '-', '+'],
        [0, '+', '+'],
        [0, '+', '-']
      ];
      const yPositon = [
        ['-', 0, '-'],
        ['-', 0, '+'],
        ['+', 0, '+'],
        ['+', 0, '-']
      ];
      const zPositon = [
        ['-', '-', 0],
        ['-', '+', 0],
        ['+', '+', 0],
        ['+', '-', 0]
      ];
      const computeOffset = (str, i, offset = 0) => {
        if (str === '-') {
          return eval(minRange.getComponent(i) + str + offset);
        }
        if (str === '+') {
          return eval(maxRange.getComponent(i) + str + offset);
        }
        return str;
      };
      const computeVector = (arr, offset) => {
        for (var i = 0; i < arr.length; i++) {
          if (['-', '+'].indexOf(arr[i]) === -1) {
            _V.setComponent(i, arr[i]);
          } else {
            _V.setComponent(i, computeOffset(arr[i], i, offset));
          }
        }
        return _V;
      };
      const computeNameV = (arr, offset) => {
        for (var i = 0; i < arr.length; i++) {
          if (['-', '+'].indexOf(arr[i]) === -1) {
            _V.setComponent(i, position[i]);
          } else {
            _V.setComponent(i, eval(arr[i] + offset));
          }
        }
        return _V;
      };
  
      const addTexts = (posArr, oText, type, a, b) => {
        for (let i = 0; i < posArr.length; i++) {
          const text = oText.clone();
          let nameV = computeNameV(posArr[i], nameOffset);
          text.add(
            this.displayText({
              text: this.option[`${type}Name`],
              position: nameV,
              size: fontSize,
              width: nameWidth,
              height: nameHeight,
              anisotropy,
              color
            })
          );
          text.position.copy(computeVector(posArr[i], offset));
          Object.assign(text.userData, {
            a,
            b,
            index: i
          });
          this.Root.add(text);
          this.TEXTS[`${type}${i}`] = text;
        }
      };
      addTexts(xPositon, xText, 'x', 1, 2);
      addTexts(yPositon, yText, 'y', 0, 2);
      addTexts(zPositon, zText, 'z', 0, 1);
    },
    upDate(camera) {
      const point = camera.position;
      for (let name in this.TEXTS) {
        const t = this.TEXTS[name];
        const { a, b, index } = t.userData;
        t.visible = this.check(point, index, a, b);
      }
    },
    getGridLineTexture(w, h, ws = 0, hs = 0, step) {
      const getCs = () => {
        const cs = document.createElement('canvas');
        cs.width = w;
        cs.height = h;
        const ctx = cs.getContext('2d');
  
        ctx.beginPath();
        ctx.lineWidth = this.option.lineWidth || 20; //step / 100 > 0 ? step / 100 : 2
        var _ws = ws % step;
        var _hs = hs % step;
  
        ctx.moveTo(0, 0);
        ctx.lineTo(0, h);
        ctx.moveTo(0, 0);
        ctx.lineTo(w, 0);
  
        while (_ws < w || _hs < h) {
          if (_ws < w) {
            ctx.moveTo(_ws, 0);
            ctx.lineTo(_ws, h);
          }
          if (_hs < h) {
            ctx.moveTo(0, _hs);
            ctx.lineTo(w, _hs);
          }
          _ws += step;
          _hs += step;
        }
  
        ctx.moveTo(w, 0);
        ctx.lineTo(w, h);
        ctx.moveTo(0, h);
        ctx.lineTo(w, h);
        ctx.strokeStyle = this.option.fontColor.getStyle();
        ctx.stroke();
        return cs;
      };
      var texture = new THREE.CanvasTexture(getCs());
      // texture.minFilter = NearestMipmapNearestFilter//LinearMipmapNearestFilter //LinearMipmapNearestFilter //LinearMipmapLinearFilter //NearestFilter //LinearFilter
      // texture.format = RGBEFormat//AlphaFormat //DepthFormat//RGBEFormat// RGBFormat//RedIntegerFormat//RedFormat// AlphaFormat
      // texture.type = UnsignedByteType //UnsignedShort4444Type//HalfFloatType//UnsignedInt248Type//UnsignedShortType//ByteType //UnsignedByteType
      if (this.option.anisotropy) {
        texture.anisotropy = this.option.anisotropy;
      }
  
      return texture;
    },
    addToScene(scene) {
      scene.add(this.Root);
    },
    check(point, num, a, b) {
      const _ia = this.option.minRange.getComponent(a);
      const _ib = this.option.minRange.getComponent(b);
      const _aa = this.option.maxRange.getComponent(a);
      const _ab = this.option.maxRange.getComponent(b);
      const _a = point.getComponent(a);
      const _b = point.getComponent(b);
      switch (num) {
        case 1:
          return (_b > _ab && _a > _ia) || (_a < _ia && _b < _ab);
        case 2:
          return (_b < _ab && _a > _aa) || (_a < _aa && _b > _ab);
        case 3:
          return (_b > _ib && _a > _aa) || (_a < _aa && _b < _ib);
        default:
          return (_b > _ib && _a < _ia) || (_a > _ia && _b < _ib);
      }
    }
  });
  /**
   *
   * @param {line,wellLength,toMin,toMax,dataMin,dataMax,arrRadius,angle} option
   */
  function LineD3(option) {
    const lines = this.computeLine(option);
    return lines;
  }
  Object.assign(LineD3.prototype, {
    setOffsetLine(target, point, normal, offset) {
      var obj = {
        x: point.x + offset * normal.x,
        y: point.y + offset * normal.y,
        z: point.z + offset * normal.z
      };
      if (target) {
        target.push(obj);
      }
      return obj;
    },
    computeFrenetFrames(curve, arrRadius, wellLength) {
      // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf
      const normal = new THREE.Vector3();
      const tangents = [];
      const seg = arrRadius.length - 1;
      const normals = [];
      const binormals = [];
      const vec = new THREE.Vector3();
      const mat = new THREE.Matrix4(); // compute the tangent vectors for each segment on the curve
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  
      wellLength = wellLength || arrRadius[seg][0];
  
      for (let i = 0; i < arrRadius.length; i++) {
        const u = arrRadius[i][0] / wellLength;
        tangents[i] = curve.getTangentAt(u, new THREE.Vector3());
        tangents[i].normalize();
      } // select an initial normal vector perpendicular to the first tangent vector,
      // and in the direction of the minimum tangent xyz component
  
      normals[0] = new THREE.Vector3();
      binormals[0] = new THREE.Vector3();
      let min = Number.MAX_VALUE;
      const tx = Math.abs(tangents[0].x);
      const ty = Math.abs(tangents[0].y);
      const tz = Math.abs(tangents[0].z);
  
      if (tx <= min) {
        min = tx;
        normal.set(1, 0, 0);
      }
  
      if (ty <= min) {
        min = ty;
        normal.set(0, 1, 0);
      }
  
      if (tz <= min) {
        normal.set(0, 0, 1);
      }
  
      vec.crossVectors(tangents[0], normal).normalize();
      normals[0].crossVectors(tangents[0], vec);
      binormals[0].crossVectors(tangents[0], normals[0]); // compute the slowly-varying normal and binormal vectors for each segment on the curve
  
      for (let i = 1; i <= seg; i++) {
        normals[i] = normals[i - 1].clone();
        binormals[i] = binormals[i - 1].clone();
        vec.crossVectors(tangents[i - 1], tangents[i]);
  
        if (vec.length() > Number.EPSILON) {
          vec.normalize();
          const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors
  
          normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
        }
  
        binormals[i].crossVectors(tangents[i], normals[i]);
      } // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same
  
      return {
        tangents: tangents,
        normals: normals,
        binormals: binormals
      };
    },
    computeLine(option) {
      // arr[2]-line，arr[3]-logData
      var curve = option.line,
        linePoints = [],
        inlinePoints = [],
        outLinePoints = [];
      var arrRadius = option.arrRadius;
      var frames = this.computeFrenetFrames(curve, arrRadius, option.wellLength);
      var P = new THREE.Vector3();
      var normal = new THREE.Vector3();
      var min = option.toMin;
      var max = option.toMax;
      var v = option.angle;
      for (var i = 0; i < arrRadius.length; i++) {
        curve.getPointAt(Math.abs(arrRadius[i][0] / option.wellLength), P);
        var radius = THREE.Math.mapLinear(
          arrRadius[i][1],
          option.dataMin,
          option.dataMax,
          min,
          max
        );
        var N = frames.normals[i];
        var B = frames.binormals[i];
  
        var sin = Math.sin(v);
        var cos = -Math.cos(v); // normal
  
        normal.x = cos * N.x + sin * B.x;
        normal.y = cos * N.y + sin * B.y;
        normal.z = cos * N.z + sin * B.z;
        normal.normalize();
  
        this.setOffsetLine(linePoints, P, normal, radius);
        this.setOffsetLine(inlinePoints, P, normal, min);
        this.setOffsetLine(outLinePoints, P, normal, max);
      }
      return {
        linePoints: linePoints,
        inlinePoints: inlinePoints,
        outLinePoints: outLinePoints
      };
    }
  });
  
  function AreaD3(option) {
    const config = this.computeArea(option);
    return config;
  }
  Object.assign(AreaD3.prototype, {
    computeArea(option) {
      const areaPoints = [];
      const areaColors = [];
      const areaIndexs = [];
      const areaNormals = [];
      const inlinePoints = [];
      const outLinePoints = [];
      const curve = option.line;
      const lut = option.lut;
      const arrRadius = option.arrRadius;
      const frames = this.computeFrenetFrames(
        curve,
        arrRadius,
        option.wellLength
      );
      var P = new THREE.Vector3();
      var normal = new THREE.Vector3();
      var min = option.toMin;
      var max = option.toMax;
      var angle = option.angle;
      for (var i = 0; i < arrRadius.length; i++) {
        curve.getPointAt(Math.abs(arrRadius[i][0] / option.wellLength), P);
        var radius = arrRadius[i][1];
        var _radius = THREE.Math.mapLinear(
          radius,
          option.dataMin,
          option.dataMax,
          min,
          max
        );
        var N = frames.normals[i];
        var B = frames.binormals[i];
  
        var sin = Math.sin(angle);
        var cos = -Math.cos(angle); // normal
  
        normal.x = cos * N.x + sin * B.x;
        normal.y = cos * N.y + sin * B.y;
        normal.z = cos * N.z + sin * B.z;
        normal.normalize();
  
        areaNormals.push(
          normal.x,
          normal.y,
          normal.z,
          normal.x,
          normal.y,
          normal.z
        );
  
        var pointl = this.setOffsetLine(inlinePoints, P, normal, min);
        this.setOffsetLine(outLinePoints, P, normal, max);
        var curPoint = this.setOffsetLine(null, P, normal, _radius);
        areaPoints.push(
          pointl.x,
          pointl.y,
          pointl.z,
          curPoint.x,
          curPoint.y,
          curPoint.z
        );
  
        if (i < arrRadius.length - 1) {
          var _i = i * 2;
          areaIndexs.push(_i, _i + 1, _i + 2, _i + 1, _i + 3, _i + 2);
        }
  
        var c = lut.getColor(radius);
  
        areaColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      return {
        areaPoints,
        areaColors,
        areaIndexs,
        areaNormals,
        inlinePoints,
        outLinePoints
      };
    },
    setOffsetLine(target, point, normal, offset) {
      var obj = {
        x: point.x + offset * normal.x,
        y: point.y + offset * normal.y,
        z: point.z + offset * normal.z
      };
      if (target) {
        target.push(obj);
      }
      return obj;
    },
    computeFrenetFrames(curve, arrRadius, wellLength) {
      // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf
      const normal = new THREE.Vector3();
      const tangents = [];
      const seg = arrRadius.length - 1;
      const normals = [];
      const binormals = [];
      const vec = new THREE.Vector3();
      const mat = new THREE.Matrix4(); // compute the tangent vectors for each segment on the curve
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  
      wellLength = wellLength || arrRadius[seg][0];
  
      for (let i = 0; i < arrRadius.length; i++) {
        const u = arrRadius[i][0] / wellLength;
        tangents[i] = curve.getTangentAt(u, new THREE.Vector3());
        tangents[i].normalize();
      } // select an initial normal vector perpendicular to the first tangent vector,
      // and in the direction of the minimum tangent xyz component
  
      normals[0] = new THREE.Vector3();
      binormals[0] = new THREE.Vector3();
      let min = Number.MAX_VALUE;
      const tx = Math.abs(tangents[0].x);
      const ty = Math.abs(tangents[0].y);
      const tz = Math.abs(tangents[0].z);
  
      if (tx <= min) {
        min = tx;
        normal.set(1, 0, 0);
      }
  
      if (ty <= min) {
        min = ty;
        normal.set(0, 1, 0);
      }
  
      if (tz <= min) {
        normal.set(0, 0, 1);
      }
  
      vec.crossVectors(tangents[0], normal).normalize();
      normals[0].crossVectors(tangents[0], vec);
      binormals[0].crossVectors(tangents[0], normals[0]); // compute the slowly-varying normal and binormal vectors for each segment on the curve
  
      for (let i = 1; i <= seg; i++) {
        normals[i] = normals[i - 1].clone();
        binormals[i] = binormals[i - 1].clone();
        vec.crossVectors(tangents[i - 1], tangents[i]);
  
        if (vec.length() > Number.EPSILON) {
          vec.normalize();
          const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors
  
          normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
        }
  
        binormals[i].crossVectors(tangents[i], normals[i]);
      } // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same
  
      return {
        tangents: tangents,
        normals: normals,
        binormals: binormals
      };
    }
  });
  export { VarTubeGeometry, Box3Grid, LineD3, AreaD3 };