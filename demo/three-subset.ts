// The parts of three.js the constellation in 3D uses, and nothing else: the page hands this to the shared renderer, so the bundle holds a few hundred kilobytes of three instead of all of it.
export { BufferAttribute, BufferGeometry, Color, LineSegments, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3, WebGLRenderer, AdditiveBlending, NormalBlending } from "three";
