const cubeOceanVs = `          
  attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;
  uniform mat4 u_viewMatrix;
  uniform mat4 u_modelMatrix;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat3 u_normalMatrix;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(u_normalMatrix * normal);
    vUv = uv;
    vec4 camPos = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);

    gl_Position = camPos;

    vWorldPosition = (u_modelMatrix * vec4(0,0,0, 1.0)).xyz;
    vPosition = (u_modelMatrix * vec4(position, 1.0)).xyz;
  } 
`;

const cubeOceanFs = `
  precision highp float;
  varying vec3 vNormal;
  varying vec2 vUv;
  varying vec4 camPos;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  uniform vec3 u_cameraPosition;

  uniform mat4 u_matrix;
  uniform float u_time;

  /* Raymarching constants */
  /* --------------------- */
  const float MAX_TRACE_DISTANCE = 10.;             // max trace distance
  const float INTERSECTION_PRECISION = 0.001;       // precision of the intersection
  const int NUM_OF_TRACE_STEPS = 128;               // max number of trace steps
  const float STEP_MULTIPLIER = .05;

  /* Structures */
  /* ---------- */
  struct Camera {
    vec3 ro;
    vec3 rd;
    float FOV;
  };

  struct Surface {
    float len;
    vec3 position;
    vec3 colour;
    float id;
    float steps;
    float AO;
  };

  struct Model {
    float dist;
    vec3 colour;
    float id;
  };

  Camera getCamera(in vec3 ro, in vec3 rd, in float FOV) {
    return Camera(
      ro,
      rd,
      FOV
    );
  }

  mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

  vec3 rotObj(vec3 p){
      
      p.yz *= rot2(u_time*-1.2);
      p.zx *= rot2(u_time*-1.5);
      return p;    
  }

  float sdBoxFrame( vec3 p, vec3 b, float e ) {
    p = abs(p  )-b;
    vec3 q = abs(p+e)-e;
    return min(min(
        length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
        length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
        length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
    }
    
    float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  Model map( vec3 p ){
    vec3 pos = (vec4(p-vWorldPosition, 1.) * u_matrix).xyz; // Transforming the cube position with the supplied transformation array
    pos = mod(pos - .5, 1.) - .5;
    return Model( 
      min(sdBoxFrame(pos, vec3(.4), .005),
          sdBoxFrame(rotObj(pos), vec3(.2), .005))
    , vec3(.5), 0.);    
  }

  float hash( float n ){
    return fract(sin(n)*3538.5453);
  }

  vec3 postEffects( in vec3 col, in vec2 uv, in float time ){
    // gamma correction
    // col = pow( clamp(col,0.0,1.0), vec3(0.45) );
    // vigneting
    col *= 0.7+0.3*pow( 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y), 0.15 );
    return col;
  }

  float thickness( in vec3 p, in vec3 n, float maxDist, float falloff ){
    float ao = 0.0;
    const int nbIte = 6;
    for( int i=0; i<nbIte; i++ )
    {
      float l = hash(float(i))*maxDist;
      vec3 rd = -n*l;
      ao += (l + map( p + rd ).dist) / pow(1.+l, falloff);
    }
    return clamp( 1.-ao/float(nbIte), 0., 1.);
  }


  Surface calcIntersection( in Camera cam ){
    float h =  INTERSECTION_PRECISION*2.0;
    float rayDepth = 0.0;
    float hitDepth = -1.0;
    float id = -1.;
    float steps = 0.;
    float ao = 0.;
    vec3 position;
    vec3 colour;

    for( int i=0; i< NUM_OF_TRACE_STEPS ; i++ ) {
      if( abs(h) < INTERSECTION_PRECISION || rayDepth > MAX_TRACE_DISTANCE ) break;
      position = cam.ro+cam.rd*rayDepth;
      Model m = map( position );
      h = m.dist;
      rayDepth += h * STEP_MULTIPLIER;
      id = m.id;
      steps += 1.;
      ao += max(h, 0.);
      colour = m.colour;
    }

    if( rayDepth < MAX_TRACE_DISTANCE ) hitDepth = rayDepth;

    return Surface( hitDepth, position, colour, id, steps, ao );
  }

  void main() {

    Camera cam = getCamera((vec4(vPosition, 1.)).xyz, normalize(vPosition - u_cameraPosition), 1.4);
    vec3 normal = normalize(vNormal);

    float lighting = dot(normal, normalize(vec3(-0.3, 0.8, 0.6)));
    vec3 colour = vec3(.2, 0.8, 1.) + normal * .2 + lighting * lighting * 0.7;

    gl_FragColor = vec4(vec3(0), 1.);

    Surface s = calcIntersection(cam);
    gl_FragColor += vec4(.5,.5,.9,1.0) * (1. - s.AO * .25);
    float thi = thickness(s.position, normal, 6., 1.5);

    gl_FragColor.rgb = mix(gl_FragColor.rgb, colour, length(sign(colour)*.5)) * thi;
    gl_FragColor.rgb = postEffects(gl_FragColor.rgb, vUv, u_time);
  }
`;

export { cubeOceanVs, cubeOceanFs};
