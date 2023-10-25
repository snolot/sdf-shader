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
  uniform sampler2D u_textureNoise;
  uniform samplerCube u_textureCube;
  uniform vec2 u_resolution;
  uniform vec3 u_color;

  #define LIGHT_COLOR vec3(240.0 / 255.0,  64.0 / 255.0,  64.0 / 255.0)
  #define PRIMARY_INTENSITY 1.3
  #define PRIMARY_CONCENTRATION 6.0
  #define SECONDARY_INTENSITY 5.0
  #define SECONDARY_CONCENTRATION 0.9
  #define AMBIENT 0.12 
  //#define REFLECTIONS 1

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
    //return Model(sdRoundBox(pos, vec3(.3), .005), vec3(.5), 0.);
    // return Model(distance(p,vWorldPosition)-.4, vec3(.5), 0.);
  }


  mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}

  vec2 Noise( in vec3 x ){
      vec3 p = floor(x);
      vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
    vec4 rg = textureLod( u_textureNoise, (uv+0.5)/256.0, 0.0 );
    return mix( rg.yw, rg.xz, f.z );
  }


//Based on TekF's "Anisotropic Highlights" (https://www.shadertoy.com/view/XdB3DG)
vec3 shade( vec3 pos, vec3 rd, vec3 normal, vec3 ligt )
{
    vec3 lcol = LIGHT_COLOR;
    float nl = dot(normal,ligt);
  vec3 light = lcol*max(.0,nl)*1.5;
  vec3 h = normalize(ligt-rd);
    vec3 rf = reflect(rd,normal);

  vec3 coord = pos*.5;
  coord.xy = coord.xy*.7071+coord.yx*.7071*vec2(1,-1);
  coord.xz = coord.xz*.7071+coord.zx*.7071*vec2(1,-1);
    vec3 coord2 = coord;
    
    //displacement of the noise grabs to create the glinting effect
    #if 1    
    vec3 ww = fwidth(pos);
    coord.xy -= h.xz*20.*ww.xy;
    coord.xz -= h.xy*20.*ww.xz;
    coord2.xy -= h.xy*5.*ww.xy;
    coord2.xz -= h.xz*5.*ww.xz;
    #endif
  
    //first layer (inner glints)
    float pw = .21*((u_resolution.x));
  vec3 aniso = vec3( Noise(coord*pw), Noise(coord.yzx*pw).x )*2.0-1.0;
    aniso -= normal*dot(aniso,normal);
  float anisotropy = min(1.,length(aniso));
  aniso /= anisotropy;
  anisotropy = .55;
  float ah = abs(dot(h,aniso));
    float nh = abs(dot(normal,h));
  float q = exp2((1.1-anisotropy)*3.5);
  nh = pow( nh, q*PRIMARY_CONCENTRATION );
  nh *= pow( 1.-ah*anisotropy, 10.0 );
  vec3 glints = lcol*nh*exp2((1.2-anisotropy)*PRIMARY_INTENSITY);
    glints *= smoothstep(.0,.5,nl);
    
    //second layer (outer glints)
    pw = .145*((u_resolution.y));
    vec3 aniso2 = vec3( Noise(coord2*pw), Noise(coord2.yzx*pw).x )*2.0-1.0;
    anisotropy = .6;
    float ah2 = abs(dot(h,aniso2));
    float q2 = exp2((.1-anisotropy)*3.5);
    float nh2 = pow( nh, q2*SECONDARY_CONCENTRATION );
    nh2 *= pow( 1.-ah2*anisotropy, 150.0 );
    vec3 glints2 = lcol*nh2*((1.-anisotropy)*SECONDARY_INTENSITY);
    glints2 *= smoothstep(.0,.4,nl);
  
    
    #ifdef REFLECTIONS
    vec3 reflection = textureCube(u_textureCube,rf).rgb;
    #else
    vec3 reflection = vec3(0);
    #endif
    
  float frnl = pow(1.0 + dot(normal,rd), 2.0);
  frnl = mix( 0.0, 0.25, frnl );
    
  return 
        mix(light*vec3(0.3), reflection, frnl) +
        glints +
        glints2 +
        reflection*0.15*(clamp(nl,0.,1.))+ reflection*0.05 +
        lcol * AMBIENT;
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


  vec3 getNormal(in vec3 p, in vec3 rd)
  {  
      vec2 e = vec2(-1., 1.)*0.01;   
    vec3 n = (e.yxx*map(p + e.yxx).dist + e.xxy*map(p + e.xxy).dist + 
             e.xyx*map(p + e.xyx).dist + e.yyy*map(p + e.yyy).dist );
      
      //from TekF (error checking)
    float gdr = dot (n, rd );
    n -= max(.0,gdr)*rd;
      return normalize(n);
  }

  void main() {
    Camera cam = getCamera((vec4(vPosition, 1.)).xyz, normalize(vPosition - u_cameraPosition), 1.4);

    vec3 normal = normalize(vNormal);
    vec3 ligt = normalize(vec3(1.,1,-.2));
    float lighting = dot(normal, vec3(-0.3, 0.8, 0.6));
    

    vec3 colour = u_color + normal *.2 + lighting * lighting * 0.3;

    gl_FragColor = vec4(vec3(0), 1.);

    Surface s = calcIntersection(cam);
    vec3 n = getNormal(s.position,cam.rd);
    vec3 c = shade(s.position, cam.rd, n, ligt);

    gl_FragColor += vec4(.5,.5,.9,1.0) * (1. - s.AO * .25);
    //gl_FragColor = vec4(c,1.) * (1. - s.AO * .25);

    gl_FragColor.rgb = mix(gl_FragColor.rgb  , colour + c * .5   , length(sign(colour + c * .5)*.5));
    //gl_FragColor = ACESFilm(gl_FragColor);
  }
`;


export { cubeInCubeVs, cubeInCubeFs };
