import * as THREE from '../../three.js-131/build/three.module.js';
import { FlakesTexture } from '../../three.js-131/examples/jsm/textures/FlakesTexture.js';
import {TWEEN} from '../../three.js-131/examples/jsm/libs/tween.module.min.js';
import Square from './Square.js';

const RotBox = (_scene, _color) => {
	const clock = new THREE.Clock();
	const scene = _scene;
	const axis = new THREE.Vector3();

	let normalMapTexture;
	let geometry, material;
	let _mesh;
	let q = new THREE.Quaternion();
	let t = 0;
	let cumul = 0;
	let unit = 1 / (Math.PI * .5);
	let initialRot;
	let moveDir;
	let dir = -.1;
	let canRot = false;
	let pt;
	let q2 = new THREE.Quaternion();

	const initGeometry = () => {
		const width = 1;
		const height = 1;
		const depth = 1;
		const radius0 = 0.08
		const smoothness = 8
		const shape = new THREE.Shape();
		const eps = 0.00001;
		const radius = radius0 - eps;
		shape.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
		shape.absarc(eps, height - radius * 2, eps, Math.PI, Math.PI / 2, true);
		shape.absarc(
			width - radius * 2,
			height - radius * 2,
			eps,
			Math.PI / 2,
			0,
			true
		);

		shape.absarc(width - radius * 2, eps, eps, 0, -Math.PI / 2, true);
		const geometry = new THREE.ExtrudeBufferGeometry(shape, {
			depth: depth - radius0 * 2,
			bevelEnabled: true,
			bevelSegments: smoothness * 2,
			steps: 1,
			bevelSize: radius,
			bevelThickness: radius0,
			curveSegments: smoothness
		});
		geometry.center();
		geometry.computeVertexNormals();

		geometry.morphAttributes.position = [];

    	// the original positions of the cube's vertices
    	const positions = geometry.attributes.position.array;
    	const spherePositions = [];

    	const twistPositions = [];
	    const direction = new THREE.Vector3(1, 0, 0).normalize();
	    const vertex = new THREE.Vector3();

	    for (let i = 0; i < positions.length; i += 3) {
	      const x = positions[i];
	      const y = positions[i + 1];
	      const z = positions[i + 2];

	      spherePositions.push(
	        x * Math.sqrt(1 - (y * y) / 2 - (z * z) / 2 + (y * y * z * z) / 3),
	        y * Math.sqrt(1 - (z * z) / 2 - (x * x) / 2 + (z * z * x * x) / 3),
	        z * Math.sqrt(1 - (x * x) / 2 - (y * y) / 2 + (x * x * y * y) / 3)
	      );

	      // stretch along the x-axis so we can see the twist better
	      vertex.set(x , y, z );

	      vertex
	        .applyAxisAngle(direction,  (Math.PI * z) / 2)
	        .toArray(twistPositions, twistPositions.length);
	    	}

	    // add the spherical positions as the first morph target
	    /*geometry.morphAttributes.position[0] = new THREE.Float32BufferAttribute(
	      spherePositions,
	      3
	    );*/

	    // add the twisted positions as the second morph target
	    geometry.morphAttributes.position[0] = new THREE.Float32BufferAttribute(
	      twistPositions,
	      3
	    );

	    
		return geometry;
	};

	const init = () => {
		console.log('RotBox::INIT');
	
		geometry = initGeometry();

		normalMapTexture = new THREE.CanvasTexture( new FlakesTexture() );
		normalMapTexture.wrapS = THREE.RepeatWrapping;
		normalMapTexture.wrapT = THREE.RepeatWrapping;
		normalMapTexture.repeat.x = 4;
		normalMapTexture.repeat.y = 4;
		normalMapTexture.anisotropy = 16;

		material = new THREE.MeshPhysicalMaterial( {
			clearcoat: .7,
			clearcoatRoughness: 0.5,
			metalness: 0.9,
			roughness: 0.3,
			//transmission:.8,
			emissiveIntensity:.7,
			color: _color,
			normalMap: normalMapTexture,
			normalScale: new THREE.Vector2( 0.5, 0.5 )
		})

		_mesh = new THREE.Mesh(geometry, material);
		_mesh.type = 'SkinnedMesh';
		_mesh.receiveShadow = true;
		_mesh.castShadow = true;

		//_mesh.updateMorphTargets();
		console.log(_mesh);
	};

	const tw = {val:0}

	const update = () => {
		const delta = clock.getDelta();
		const time = clock.getElapsedTime();
		//_mesh.morphTargetInfluences[0] = tw.val;

		if (canRot) {	
			if( t < 1 ){

				

				if(_mesh.quaternion.angleTo(q2) > Math.PI * .5 ) {
					if(moveDir == 38 || moveDir == 40){
						_mesh.rotation.set(0,0,0);
						_mesh.position.y = 0
						canRot = false;
					} else {
						_mesh.rotation.set(0,0,0);
						_mesh.position.y = 0
						canRot = false;
					}
				} else {
					if(moveDir == 38 || moveDir == 39) dir = -.1;
					else if(moveDir == 37 || moveDir == 40) dir = .1;
					rotateAroundWorldAxis(pt, axis, dir);
				}
			} else {
				canRot = false;
			}
		}
	};

	const rotTwist = () => {
		const b = new TWEEN.Tween(tw).to({val:0}, 250);
		new TWEEN.Tween(tw).to({val:1}, 250).chain(b).start();
	};

	const spawMesh = () => {
		const s = Square((m) => {			
			scene.remove(m)
		}, normalMapTexture, _color);	
		scene.add(s.mesh);
		
		s.mesh.position.copy(_mesh.position);
		s.mesh.position.y -= .5
	};

	const move = (code) => {
		moveDir = code;
		spawMesh();
		rotTwist();
		pt = _mesh.position.clone();

		if (code === 38 || code === 40) {			
			pt.z += (code===38) ? -0.5 : 0.5;
			axis.set(1,0,0);
		} else if (code === 37 || code ===39) {
			pt.x += (code === 37) ? -0.5 : 0.5;
			axis.set(0,0,1);
		}

		pt.y -= 0.5;
		t = 0;
		canRot = true;
		q2 = _mesh.quaternion.clone();
	};

	const base = {
		init,
		move,
		update,
	};

	Object.defineProperty(base, 'mesh', {
		get: () => _mesh,
	});
	
	return base;
}

export default RotBox;
