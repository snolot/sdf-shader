import * as THREE from '../libs/build/three.module.js'

const quickhull = (function(){


  var faces     = [],
    faceStack   = [],
    i, NUM_POINTS, extremes,
    max     = 0,
    dcur, current, j, v0, v1, v2, v3,
    N, D;

  var ab, ac, ax,
    suba, subb, normal,
    diff, subaA, subaB, subC;

  function reset(){

    ab    = new THREE.Vector3(),
    ac    = new THREE.Vector3(),
    ax    = new THREE.Vector3(),
    suba  = new THREE.Vector3(),
    subb  = new THREE.Vector3(),
    normal  = new THREE.Vector3(),
    diff  = new THREE.Vector3(),
    subaA = new THREE.Vector3(),
    subaB = new THREE.Vector3(),
    subC  = new THREE.Vector3();

  }

  //temporary vectors

  function process( points ){

    // Iterate through all the faces and remove
    while( faceStack.length > 0  ){
      cull( faceStack.shift(), points );
    }
  }


  var norm = function(){

    var ca = new THREE.Vector3(),
      ba = new THREE.Vector3(),
      N = new THREE.Vector3();

    return function( a, b, c ){

      ca.subVectors( c, a );
      ba.subVectors( b, a );

      N.crossVectors( ca, ba );

      return N.normalize();
    }

  }();


  function getNormal( face, points ){

    if( face.normal !== undefined ) return face.normal;

    var p0 = points[face[0]],
      p1 = points[face[1]],
      p2 = points[face[2]];

    ab.subVectors( p1, p0 );
    ac.subVectors( p2, p0 );
    normal.crossVectors( ac, ab );
    normal.normalize();

    return face.normal = normal.clone();

  }


  function assignPoints( face, pointset, points ){

    // ASSIGNING POINTS TO FACE
    var p0 = points[face[0]],
      dots = [], apex,
      norm = getNormal( face, points );


    // Sory all the points by there distance from the plane
    pointset.sort( function( aItem, bItem ){


      dots[aItem.x/3] = dots[aItem.x/3] !== undefined ? dots[aItem.x/3] : norm.dot( suba.subVectors( aItem, p0 ));
      dots[bItem.x/3] = dots[bItem.x/3] !== undefined ? dots[bItem.x/3] : norm.dot( subb.subVectors( bItem, p0 ));

      return dots[aItem.x/3] - dots[bItem.x/3] ;
    });

    //TODO :: Must be a faster way of finding and index in this array
    var index = pointset.length;

    if( index === 1 ) dots[pointset[0].x/3] = norm.dot( suba.subVectors( pointset[0], p0 ));
    while( index-- > 0 && dots[pointset[index].x/3] > 0 )

    var point;
    if( index + 1 < pointset.length && dots[pointset[index+1].x/3] > 0 ){

      face.visiblePoints  = pointset.splice( index + 1 );
    }
  }




  function cull( face, points ){

    var i = faces.length,
      dot, visibleFace, currentFace,
      visibleFaces = [face];

    var apex = points.indexOf( face.visiblePoints.pop() );

    // Iterate through all other faces...
    while( i-- > 0 ){
      currentFace = faces[i];
      if( currentFace !== face ){
        // ...and check if they're pointing in the same direction
        dot = getNormal( currentFace, points ).dot( diff.subVectors( points[apex], points[currentFace[0]] ));
        if( dot > 0 ){
          visibleFaces.push( currentFace );
        }
      }
    }

    var index, neighbouringIndex, vertex;

    // Determine Perimeter - Creates a bounded horizon

    // 1. Pick an edge A out of all possible edges
    // 2. Check if A is shared by any other face. a->b === b->a
      // 2.1 for each edge in each triangle, isShared = ( f1.a == f2.a && f1.b == f2.b ) || ( f1.a == f2.b && f1.b == f2.a )
    // 3. If not shared, then add to convex horizon set,
        //pick an end point (N) of the current edge A and choose a new edge NA connected to A.
        //Restart from 1.
    // 4. If A is shared, it is not an horizon edge, therefore flag both faces that share this edge as candidates for culling
    // 5. If candidate geometry is a degenrate triangle (ie. the tangent space normal cannot be computed) then remove that triangle from all further processing


    var j = i = visibleFaces.length;
    var isDistinct = false,
      hasOneVisibleFace = i === 1,
      cull = [],
      perimeter = [],
      edgeIndex = 0, compareFace, nextIndex,
      a, b;

    var allPoints = [];
    var originFace = [visibleFaces[0][0], visibleFaces[0][1], visibleFaces[0][1], visibleFaces[0][2], visibleFaces[0][2], visibleFaces[0][0]];


    if( visibleFaces.length === 1 ){
      currentFace = visibleFaces[0];

      perimeter = [currentFace[0], currentFace[1], currentFace[1], currentFace[2], currentFace[2], currentFace[0]];
      // remove visible face from list of faces
      if( faceStack.indexOf( currentFace ) > -1 ){
        faceStack.splice( faceStack.indexOf( currentFace ), 1 );
      }


      if( currentFace.visiblePoints ) allPoints = allPoints.concat( currentFace.visiblePoints );
      faces.splice( faces.indexOf( currentFace ), 1 );

    }else{

      while( i-- > 0  ){  // for each visible face

        currentFace = visibleFaces[i];

        // remove visible face from list of faces
        if( faceStack.indexOf( currentFace ) > -1 ){
          faceStack.splice( faceStack.indexOf( currentFace ), 1 );
        }

        if( currentFace.visiblePoints ) allPoints = allPoints.concat( currentFace.visiblePoints );
        faces.splice( faces.indexOf( currentFace ), 1 );


        var isSharedEdge;
        cEdgeIndex = 0;

        while( cEdgeIndex < 3 ){ // Iterate through it's edges

          isSharedEdge = false;
          j = visibleFaces.length;
          a = currentFace[cEdgeIndex]
          b = currentFace[(cEdgeIndex+1)%3];


          while( j-- > 0 && !isSharedEdge ){ // find another visible faces

            compareFace = visibleFaces[j];
            edgeIndex = 0;

            // isSharedEdge = compareFace == currentFace;
            if( compareFace !== currentFace ){

              while( edgeIndex < 3 && !isSharedEdge ){ //Check all it's indices

                nextIndex = ( edgeIndex + 1 );
                isSharedEdge = ( compareFace[edgeIndex] === a && compareFace[nextIndex%3] === b ) ||
                         ( compareFace[edgeIndex] === b && compareFace[nextIndex%3] === a );

                edgeIndex++;
              }
            }
          }

          if( !isSharedEdge || hasOneVisibleFace ){
            perimeter.push( a );
            perimeter.push( b );
          }

          cEdgeIndex++;
        }
      }
    }

    // create new face for all pairs around edge
    i = 0;
    var l = perimeter.length/2;
    var f;

    while( i < l ){
      f = [ perimeter[i*2+1], apex, perimeter[i*2] ];
      assignPoints( f, allPoints, points );
      faces.push( f )
      if( f.visiblePoints !== undefined  )faceStack.push( f );
      i++;
    }

  }

  var distSqPointSegment = function(){

    var ab = new THREE.Vector3(),
      ac = new THREE.Vector3(),
      bc = new THREE.Vector3();

    return function( a, b, c ){

        ab.subVectors( b, a );
        ac.subVectors( c, a );
        bc.subVectors( c, b );

        var e = ac.dot(ab);
        if (e < 0.0) return ac.dot( ac );
        var f = ab.dot( ab );
        if (e >= f) return bc.dot(  bc );
        return ac.dot( ac ) - e * e / f;

      }

  }();





  return function( geometry ){

    reset();


    let points    = geometry.vertices;
    let faces     = [],
    faceStack   = [],
    i       = NUM_POINTS = points.length,
    extremes  = points.slice( 0, 6 ),
    max     = 0;



    /*
     *  FIND EXTREMETIES
     */
    while( i-- > 0 ){
      if( points[i].x < extremes[0].x ) extremes[0] = points[i];
      if( points[i].x > extremes[1].x ) extremes[1] = points[i];

      if( points[i].y < extremes[2].y ) extremes[2] = points[i];
      if( points[i].y < extremes[3].y ) extremes[3] = points[i];

      if( points[i].z < extremes[4].z ) extremes[4] = points[i];
      if( points[i].z < extremes[5].z ) extremes[5] = points[i];
    }


    /*
     *  Find the longest line between the extremeties
     */

    j = i = 6;
    while( i-- > 0 ){
      j = i - 1;
      while( j-- > 0 ){
          if( max < (dcur = extremes[i].distanceToSquared( extremes[j] )) ){
        max = dcur;
        v0 = extremes[ i ];
        v1 = extremes[ j ];

          }
        }
      }


      // 3. Find the most distant point to the line segment, this creates a plane
      i = 6;
      max = 0;
    while( i-- > 0 ){
      dcur = distSqPointSegment( v0, v1, extremes[i]);
      if( max < dcur ){
        max = dcur;
            v2 = extremes[ i ];
          }
    }


      // 4. Find the most distant point to the plane.

      N = norm(v0, v1, v2);
      D = N.dot( v0 );


      max = 0;
      i = NUM_POINTS;
      while( i-- > 0 ){
        dcur = Math.abs( points[i].dot( N ) - D );
          if( max < dcur ){
            max = dcur;
            v3 = points[i];
      }
      }



      var v0Index = points.indexOf( v0 ),
      v1Index = points.indexOf( v1 ),
      v2Index = points.indexOf( v2 ),
      v3Index = points.indexOf( v3 );


    //  We now have a tetrahedron as the base geometry.
    //  Now we must subdivide the

      var tetrahedron =[
        [ v2Index, v1Index, v0Index ],
        [ v1Index, v3Index, v0Index ],
        [ v2Index, v3Index, v1Index ],
        [ v0Index, v3Index, v2Index ],
    ];



    subaA.subVectors( v1, v0 ).normalize();
    subaB.subVectors( v2, v0 ).normalize();
    subC.subVectors ( v3, v0 ).normalize();
    var sign  = subC.dot( new THREE.Vector3().crossVectors( subaB, subaA ));


    // Reverse the winding if negative sign
    if( sign < 0 ){
      tetrahedron[0].reverse();
      tetrahedron[1].reverse();
      tetrahedron[2].reverse();
      tetrahedron[3].reverse();
    }


    //One for each face of the pyramid
    var pointsCloned = points.slice();
    pointsCloned.splice( pointsCloned.indexOf( v0 ), 1 );
    pointsCloned.splice( pointsCloned.indexOf( v1 ), 1 );
    pointsCloned.splice( pointsCloned.indexOf( v2 ), 1 );
    pointsCloned.splice( pointsCloned.indexOf( v3 ), 1 );


    let ii = tetrahedron.length;
    while( ii-- > 0 ){
      assignPoints( tetrahedron[ii], pointsCloned, points );
      if( tetrahedron[ii].visiblePoints !== undefined ){
        faceStack.push( tetrahedron[ii] );
      }
      faces.push( tetrahedron[ii] );
    }

    process( points );


    //  Assign to our geometry object

    var ll = faces.length;
    while( ll-- > 0 ){
      geometry.faces[ll] = new THREE.Face3( faces[ll][2], faces[ll][1], faces[ll][0], faces[ll].normal )
    }

    geometry.normalsNeedUpdate = true;

    return geometry;

  }

}())

/******************************************************************************
 * Utils
 */

/**
 * Returns a single geometry for the given object. If the object is compound,
 * its geometries are automatically merged.
 * @param {THREE.Object3D} object
 * @return {THREE.Geometry}
 */
function getGeometry (object) {
  console.log('getGeometry');
  console.log(object);
  var matrix, mesh,
      meshes = getMeshes(object),
      tmp = new THREE.Geometry(),
      combined = new THREE.Geometry();

  if (meshes.length === 0) return null;

  // Apply scale  – it can't easily be applied to a CANNON.Shape later.
  if (meshes.length === 1) {
    var position = new THREE.Vector3(),
        quaternion = new THREE.Quaternion(),
        scale = new THREE.Vector3();
    tmp = meshes[0].geometry.clone();
    tmp.metadata = meshes[0].geometry.metadata;
    meshes[0].updateMatrixWorld();
    meshes[0].matrixWorld.decompose(position, quaternion, scale);
    return tmp.scale(scale.x, scale.y, scale.z);
  }

  // Recursively merge geometry, preserving local transforms.
  while ((mesh = meshes.pop())) {
    mesh.updateMatrixWorld();
    if (mesh.geometry instanceof THREE.BufferGeometry) {
      tmp.fromBufferGeometry(mesh.geometry);
      combined.merge(tmp, mesh.matrixWorld);
    } else {
      combined.merge(mesh.geometry, mesh.matrixWorld);
    }
  }

  matrix = new THREE.Matrix4();
  matrix.scale(object.scale);
  combined.applyMatrix(matrix);
  return combined;
}

/**
 * @param  {THREE.Geometry} geometry
 * @return {Array<number>}
 */
function getVertices (geometry) {

  if (!geometry.attributes) {
    geometry = new THREE.BufferGeometry().fromGeometry(geometry);
  }
  return (geometry.attributes.position || {}).array || [];
}

/**
 * Returns a flat array of THREE.Mesh instances from the given object. If
 * nested transformations are found, they are applied to child meshes
 * as mesh.userData.matrix, so that each mesh has its position/rotation/scale
 * independently of all of its parents except the top-level object.
 * @param  {THREE.Object3D} object
 * @return {Array<THREE.Mesh>}
 */
function getMeshes (object) {
  var meshes = [];
  object.traverse(function (o) {
    if (o.type === 'Mesh') {
      console.log('FIND MESH')
      meshes.push(o);
    }
  });
  return meshes;
}


 /**
 * @param  {THREE.Geometry} geometry
 * @return {CANNON.Shape}
 */
function createTrimeshShape (geometry) {
  var indices,
      vertices = getVertices(geometry);

  if (!vertices.length) return null;

  indices = Object.keys(vertices).map(Number);
  return new CANNON.Trimesh(vertices, indices);
}

function createTrimeshFromObject(object){
  console.log('createTrimeshFromObject');
  geometry = getGeometry(object);
  return geometry ? createTrimeshShape(geometry) : null;
}

/**
  * @param  {THREE.Geometry} geometry
  * @return {CANNON.Shape}
  */
 function createBoxShape (geometry) {
   var vertices = getVertices(geometry);

   if (!vertices.length) return null;

   geometry.computeBoundingBox();
   var box = geometry.boundingBox;
   return new CANNON.Box(new CANNON.Vec3(
     (box.max.x - box.min.x) / 2,
     (box.max.y - box.min.y) / 2,
     (box.max.z - box.min.z) / 2
   ));
 }

/**
 * Bounding box needs to be computed with the entire mesh, not just geometry.
 * @param  {THREE.Object3D} mesh
 * @return {CANNON.Shape}
 */
function createBoundingBoxShape (object) {
  //console.log('createBoundingBoxShape');
  var shape, localPosition, worldPosition,
      box = new THREE.Box3();

  box.setFromObject(object);

  if (!isFinite(box.min.lengthSq())) return null;

  shape = new CANNON.Box(new CANNON.Vec3(
    (box.max.x - box.min.x) / 2,
    (box.max.y - box.min.y) / 2,
    (box.max.z - box.min.z) / 2
  ));
  //console.log(shape);
  
  object.updateMatrixWorld();
  worldPosition = new THREE.Vector3();
  worldPosition.setFromMatrixPosition(object.matrixWorld);
  localPosition = box.translate(worldPosition.negate()).getCenter();
  if (localPosition.lengthSq()) {
    shape.offset = localPosition;
  }

  return shape;
}

/**
 * Computes 3D convex hull as a CANNON.ConvexPolyhedron.
 * @param  {THREE.Object3D} mesh
 * @return {CANNON.Shape}
 */


function createConvexPolyhedron (object) {
  console.log('createConvexPolyhedron');
  console.log(object);

  var i, vertices, faces, hull,
      eps = 1e-4,
      geometry = getGeometry(object);
  console.log(geometry);

  if (!geometry || !geometry.vertices.length) return null;

  // Perturb.
  for (i = 0; i < geometry.vertices.length; i++) {
    geometry.vertices[i].x += (Math.random() - 0.5) * eps;
    geometry.vertices[i].y += (Math.random() - 0.5) * eps;
    geometry.vertices[i].z += (Math.random() - 0.5) * eps;
  }

  // Compute the 3D convex hull.
  hull = quickhull(geometry);

  // Convert from THREE.Vector3 to CANNON.Vec3.
  vertices = new Array(hull.vertices.length);
  for (i = 0; i < hull.vertices.length; i++) {
    vertices[i] = new CANNON.Vec3(hull.vertices[i].x, hull.vertices[i].y, hull.vertices[i].z);
  }

  // Convert from THREE.Face to Array<number>.
  faces = new Array(hull.faces.length);
  for (i = 0; i < hull.faces.length; i++) {
    faces[i] = [hull.faces[i].a, hull.faces[i].b, hull.faces[i].c];
  }

  var cp = new CANNON.ConvexPolyhedron(vertices, faces);
  //cp.collisionResponse = false;
  return cp;
}

export {createConvexPolyhedron, createTrimeshFromObject, createTrimeshShape}