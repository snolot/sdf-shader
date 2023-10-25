const cubeHoleVs = `
  /*attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;*/
  uniform mat4 u_viewMatrix;
  uniform mat4 u_modelMatrix;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat3 u_normalMatrix;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying vec2 vUV;
  
  void main() {
    vNormal = normalize(u_normalMatrix * normal);
    vUV = uv;
    vec4 camPos = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);
    
    gl_Position = camPos;
    
    // gl_LineWidth = 2.;
    
    vWorldPosition = (u_modelMatrix * vec4(0,0,0, 1.0)).xyz;
    vPosition = (u_modelMatrix * vec4(position, 1.0)).xyz;
  }
`;

const cubeHoleFs = `
  precision highp float;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying vec4 camPos;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  uniform vec3 u_cameraPosition;
  
  uniform mat4 u_matrix;
  
  /* Raymarching constants */
  /* --------------------- */
  const float MAX_TRACE_DISTANCE = 5.;             // max trace distance
  const float INTERSECTION_PRECISION = 0.0001;       // precision of the intersection
  const int NUM_OF_TRACE_STEPS = 32;               // max number of trace steps
  const float STEP_MULTIPLIER = 1.;
  
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
  float sdCylinder( vec3 p, vec3 c ) {
    return length(p.xz-c.xy)-c.z;
  }
  
  Model map( vec3 p ){
    vec3 pos = (vec4(p-vWorldPosition, 1.) * u_matrix).xyz; // Transforming the cube position with the supplied transformation array
    
    // return Model(length(pos)-.4, vec3(.5), 0.);
    
    float cyl = min(
      min(
        sdCylinder(pos, vec3(0., 0.0, .3)),
        sdCylinder(vec3(abs(pos.y) - .15, pos.x, abs(pos.z) - .15), vec3(0., 0.0, .11))
      ),
      sdCylinder(pos.xzy, vec3(0., 0.0, .3))
      );
    
    return Model(
      max(sdRoundBox(pos, vec3(.4), .1),
          -cyl), vec3(.5), 0.);
  }
  
  vec3 shade(Surface surface, vec3 nor, vec3 ref, Camera cam) {
    
    vec3 col = surface.colour;
    vec3 pos = surface.position;
    
    vec3 l = (vec4(-0.6, 0.8, 0.2, 1.)).xyz;
    
    vec3 I = normalize(pos - cam.ro);
    // reflection *= 0.;
    // col = reflection;
    // lighitng        
    float occ = smoothstep(4., 0., surface.AO);
    vec3  lig = normalize( l );
    float amb = clamp( 0.5+0.5*-nor.y, 0.0, 1.0 );
    float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
    float fre = pow( clamp(1.0+dot(nor,cam.rd),0.0,1.0), 2.0 );
    float spe = pow(clamp( dot( ref, lig ), 0.0, 1.0 ),4.0);

    // dif *= softshadow( pos, lig, 0.02, 2.5 );
    //dom *= softshadow( pos, ref, 0.02, 2.5 );

    vec3 lin = vec3(0.0);
    lin += 1.20*dif*vec3(.95,0.80,0.60);
    lin += .60*spe*vec3(1.00,0.85,0.55)*dif;
    lin += 0.50*amb*vec3(0.50,0.70,.80);
    lin += 0.20*fre*vec3(1.00,1.00,1.00);
    col = col*lin*occ;
    
    //float fog = smoothstep(5., .5, length(pos));
    
    //col *= fog*fog;

    return col;
  }
  
  // Calculates the normal by taking a very small distance,
  // remapping the function, and getting normal for that
  vec3 calcNormal( in vec3 pos ){
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
      map(pos+eps.xyy).dist - map(pos-eps.xyy).dist,
      map(pos+eps.yxy).dist - map(pos-eps.yxy).dist,
      map(pos+eps.yyx).dist - map(pos-eps.yyx).dist );
    return normalize(nor);
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
    else id = -1.;

    return Surface( hitDepth, position, colour, id, steps, ao );
  }
  
  void main() {
    
    vec3 campos = vPosition;
    vec3 normal = vNormal;
    vec3 rd = normalize(vPosition - u_cameraPosition);
    
    Camera cam = getCamera(campos, rd, 1.4);
    
    gl_FragColor = vec4(vec3(0), 1.);
    
    Surface s = calcIntersection(cam);
    if(s.id > -1.) {
      // gl_FragColor += vec4(.5,.5,.9,1.0) * smoothstep(20., 0., s.AO);
      
      vec3 surfaceNormal = calcNormal( s.position );
      vec3 ref = reflect(cam.rd, surfaceNormal);
      vec3 scolour = shade(s, surfaceNormal, ref, cam);
      gl_FragColor.rgb += scolour;
      
    } else {
      gl_FragColor = vec4(1,0,0,0);
    }
  }
`;

const cubeInCubeVs = `          
  /*attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;*/
  uniform mat4 u_viewMatrix;
  uniform mat4 u_modelMatrix;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat3 u_normalMatrix;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  //varying vec2 vUV;

  void main() {
    vNormal = normalize(u_normalMatrix * normal);
    //vUV = uv;
    vec4 camPos = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);

    gl_Position = camPos;

    vWorldPosition = (u_modelMatrix * vec4(0,0,0, 1.0)).xyz;
    vPosition = (u_modelMatrix * vec4(position, 1.0)).xyz;
  } 
`;

const cubeInCubeFs = `
  precision highp float;
  varying vec3 vNormal;
  // varying vec2 vUV;
  varying vec4 camPos;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  uniform vec3 u_cameraPosition;

  uniform mat4 u_matrix;

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

  float saturate(in float x) { return clamp(x, 0.0, 1.0); }
  vec2 saturate(in vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
  vec3 saturate(in vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
  vec4 saturate(in vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }


  vec4 ACESFilm(vec4 x)
  {
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return saturate((x*(a*x+b))/(x*(c*x+d)+e));
  }

  vec4 linearTosRGB(vec4 linearRGB){
      vec4 cutoff = vec4(lessThan(linearRGB, vec4(0.0031308)));
      vec4 higher = vec4(1.055)*pow(linearRGB, vec4(1.0/2.4)) - vec4(0.055);
      vec4 lower = linearRGB * vec4(12.92);

      return mix(higher, lower, cutoff);
  }

  Camera getCamera(in vec3 ro, in vec3 rd, in float FOV) {
    return Camera(
      ro,
      rd,
      FOV
    );
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
      min(
        sdBoxFrame(pos, vec3(.35), .001) - .01,
        sdRoundBox(pos, vec3(.1), .01)
        ), vec3(.5), 0.);
    // return Model(sdRoundBox(pos, vec3(.4), .05), vec3(.5), 0.);
    // return Model(distance(p,vWorldPosition)-.4, vec3(.5), 0.);
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
    vec3 colour = vec3(.2, 0.8, 1.) + normal * .2 + lighting * lighting * 0.3;

    gl_FragColor = vec4(vec3(0), 1.);

    Surface s = calcIntersection(cam);
    gl_FragColor += vec4(.5,.5,.9,1.0) * (1. - s.AO * .25);


    gl_FragColor.rgb = mix(gl_FragColor.rgb, colour, length(sign(colour)*.5));
    //gl_FragColor = ACESFilm(gl_FragColor);
  }
`;

const cubeInCubeAnimVs = `          
 /* attribute vec3 position;
  attribute vec3 normal;
  attribute vec2 uv;*/
  uniform mat4 u_viewMatrix;
  uniform mat4 u_modelMatrix;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  uniform mat3 u_normalMatrix;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  //varying vec2 vUV;
  uniform samplerCube u_textureCube;

  void main() {
    vNormal = normalize(u_normalMatrix * normal);
    //vUV = uv;
    vec4 camPos = u_projectionMatrix * u_modelViewMatrix * vec4(position, 1.0);

    gl_Position = camPos;

    vWorldPosition = (u_modelMatrix * vec4(0,0,0, 1.0)).xyz;
    vPosition = (u_modelMatrix * vec4(position, 1.0)).xyz;
  } 
`;

const cubeInCubeAnimFs = `
  precision highp float;
  varying vec3 vNormal;
  // varying vec2 vUV;
  varying vec4 camPos;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  uniform vec3 u_cameraPosition;
  uniform float u_time;
  uniform samplerCube u_textureCube;

  uniform mat4 u_matrix;

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

  float saturate(in float x) { return clamp(x, 0.0, 1.0); }
  vec2 saturate(in vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
  vec3 saturate(in vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
  vec4 saturate(in vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }


  vec4 ACESFilm(vec4 x){
      float a = 2.51;
      float b = 0.03;
      float c = 2.43;
      float d = 0.59;
      float e = 0.14;
      return saturate((x*(a*x+b))/(x*(c*x+d)+e));
  }

  vec4 linearTosRGB(vec4 linearRGB){
      vec4 cutoff = vec4(lessThan(linearRGB, vec4(0.0031308)));
      vec4 higher = vec4(1.055)*pow(linearRGB, vec4(1.0/2.4)) - vec4(0.055);
      vec4 lower = linearRGB * vec4(12.92);

      return mix(higher, lower, cutoff);
  }

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
    p = rotObj(p);
    p = abs(p)-b;
    

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
      min(
        sdBoxFrame(pos, vec3(.25), .001) - .01,
        sdRoundBox(pos, vec3(.1), .01)
        ), vec3(.5), 0.);
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
    vec3 colour = vec3(.2, 0.8, 1.) + normal * .2 + lighting * lighting * 0.3;

    gl_FragColor = vec4(vec3(0), 1.);

    Surface s = calcIntersection(cam);
    gl_FragColor += vec4(.5,.5,.9,1.0) * (1. - s.AO * .25);


    gl_FragColor.rgb = mix(gl_FragColor.rgb, colour, length(sign(colour)*.5));
    //gl_FragColor.rgb += textureCube(u_textureCube, normalize(cam.ro)).xyz * .02;

    //gl_FragColor = ACESFilm(gl_FragColor);
  }
`;

export { cubeHoleVs, cubeHoleFs, cubeInCubeVs, cubeInCubeFs, cubeInCubeAnimVs, cubeInCubeAnimFs };
