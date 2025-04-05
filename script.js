// 3D Background Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 30000); // Increased far plane
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('modelCanvas'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const models = [];
let currentModelIndex = 0;
let targetModelIndex = 0;
let lastScrollTime = 0;
const scrollCooldown = 500;
const transitionDuration = 1000;
const transitionProgress = { value: 0 };
let isTransitioning = false;
const modelStates = [];

const light = new THREE.PointLight(0xffffff, 1, 15000); // Increased light distance
light.position.set(5000, 5000, 5000); // Increased position
scene.add(light);

camera.position.z = 20000; // Increased camera distance to view massive torus

// Torus Knot Model (Much Larger Dimensions)
const torusGeometry = new THREE.TorusKnotGeometry(5000, 1500, 100, 16); // Massive radius and tube
const torusMaterial = new THREE.MeshBasicMaterial({ color: 0x8749f2, wireframe: true });
const torusKnot = new THREE.Mesh(torusGeometry, torusMaterial);
models.push(torusKnot);

// Neural Network Model (Unchanged Large Dimensions)
const neuralNetworkGroup = new THREE.Group();
const layers = [4, 8, 6, 5, 3];
const spacing = 5000;
const neuronMaterial = new THREE.MeshBasicMaterial({ color: 0xcc66ff });
const neuronGeometry = new THREE.SphereGeometry(100, 16, 16);
const neurons = [];

layers.forEach((count, layerIndex) => {
    const angleStep = (Math.PI * 2) / count;
    const z = layerIndex * spacing - (layers.length * spacing) / 2;
    const layerNeurons = [];
    for (let i = 0; i < count; i++) {
        const angle = i * angleStep;
        const x = Math.cos(angle) * 3900;
        const y = Math.sin(angle) * 3900;
        const neuron = new THREE.Mesh(neuronGeometry, neuronMaterial);
        neuron.position.set(x, y, z);
        neuralNetworkGroup.add(neuron);
        layerNeurons.push(neuron.position);
    }
    neurons.push(layerNeurons);
});

const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, opacity: 0.3, transparent: true });
for (let i = 0; i < neurons.length - 1; i++) {
    for (const a of neurons[i]) {
        for (const b of neurons[i + 1]) {
            const points = [a.clone(), b.clone()];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            neuralNetworkGroup.add(line);
        }
    }
}
models.push(neuralNetworkGroup);

// Line Segments Model (Unchanged Large Dimensions)
// Semi-Complex 3D Function Model (z = sin(x) * cos(y) + 0.001 * (x^2 + y^2))
const semiComplexGeometry = new THREE.PlaneGeometry(10000, 10000, 32, 32); // Width, height, width segments, height segments
const semiComplexMaterial = new THREE.MeshBasicMaterial({ color: 0x8749f2, wireframe: true });
const semiComplexSurface = new THREE.Mesh(semiComplexGeometry, semiComplexMaterial);

// Modify z-coordinates for semi-complex function
const positionAttribute = semiComplexGeometry.attributes.position;
for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i) * 0.018; // Scale x for frequency
    const y = positionAttribute.getY(i) * 0.018; // Scale y for frequency
    const z = 500 * (Math.sin(x) * Math.cos(y) + 0.001 * (x * x + y * y));
    positionAttribute.setZ(i, z);
}
semiComplexGeometry.computeVertexNormals(); // Update normals for proper rendering
semiComplexSurface.rotation.x = -40 * Math.PI / 180; // ~15 degrees
semiComplexSurface.position.set(0, -500, 0)
models.push(semiComplexSurface);

function initializeModelStates() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(75 / 2)) * 200; // Increased frustum
    const frustumWidth = frustumHeight * aspect;

    models.forEach((model, index) => {
        modelStates[index] = {
            currentPosition: new THREE.Vector3(),
            targetPosition: new THREE.Vector3(),
            currentScale: new THREE.Vector3(1, 1, 1),
            targetScale: new THREE.Vector3(1, 1, 1),
        };
        if (index === currentModelIndex) {
            model.position.set(frustumWidth * 0.1, 0, 0);
            model.scale.set(1, 1, 1);
        } else if (index === (currentModelIndex + 1) % models.length) {
            model.position.set(frustumWidth * 0.4, 0, -10000); // Increased depth
            model.scale.set(0.3, 0.3, 0.3);
        } else {
            model.position.set(0, 0, -40000); // Increased depth
            model.scale.set(0.1, 0.1, 0.1);
        }
        modelStates[index].currentPosition.copy(model.position);
        modelStates[index].targetPosition.copy(model.position);
        modelStates[index].currentScale.copy(model.scale);
        modelStates[index].targetScale.copy(model.scale);
    });
}

function updateModelTargets() {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumHeight = 2 * Math.tan(THREE.MathUtils.degToRad(75 / 2)) * 20000;
    const frustumWidth = frustumHeight * aspect;

    models.forEach((model, index) => {
        if (index === targetModelIndex) {
            modelStates[index].targetPosition.set(frustumWidth * 0.1, 0, 0);
            modelStates[index].targetScale.set(1, 1, 1);
        } else if (index === (targetModelIndex + 1) % models.length) {
            modelStates[index].targetPosition.set(frustumWidth * 0.4, 0, -10000);
            modelStates[index].targetScale.set(0.3, 0.3, 0.3);
        } else {
            modelStates[index].targetPosition.set(0, 0, -40000);
            modelStates[index].targetScale.set(0.1, 0.1, 0.1);
        }
    });

    transitionProgress.value = 0;
    isTransitioning = true;
}

function animateTransition() {
    if (!isTransitioning) return;

    transitionProgress.value += 1 / (transitionDuration / 16);
    const t = Math.min(transitionProgress.value, 1);
    const easeT = 1 - Math.pow(1 - t, 3);

    models.forEach((model, index) => {
        const state = modelStates[index];
        model.position.lerpVectors(state.currentPosition, state.targetPosition, easeT);
        model.scale.lerpVectors(state.currentScale, state.targetScale, easeT);
    });

    if (t >= 1) {
        isTransitioning = false;
        currentModelIndex = targetModelIndex;
        models.forEach((model, index) => {
            const state = modelStates[index];
            state.currentPosition.copy(model.position);
            state.currentScale.copy(model.scale);
        });
    }
}

window.addEventListener('wheel', (event) => {
    if (isTransitioning) return;
    const currentTime = Date.now();
    if (currentTime - lastScrollTime < scrollCooldown) return;

    const deltaX = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (Math.abs(deltaX) > 0) {
        lastScrollTime = currentTime;
        if (deltaX > 0) {
            targetModelIndex = (currentModelIndex + 1) % models.length;
        } else if (deltaX < 0) {
            targetModelIndex = (currentModelIndex - 1 + models.length) % models.length;
        }
        updateModelTargets();
    }
});

let touchStartX = 0;
window.addEventListener('touchstart', (event) => {
    touchStartX = event.touches[0].clientX;
});

window.addEventListener('touchmove', (event) => {
    if (isTransitioning) return;
    const currentTime = Date.now();
    if (currentTime - lastScrollTime < scrollCooldown) return;

    const touchEndX = event.touches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (Math.abs(deltaX) > 50) {
        lastScrollTime = currentTime;
        if (deltaX < 0) {
            targetModelIndex = (currentModelIndex + 1) % models.length;
        } else if (deltaX > 0) {
            targetModelIndex = (currentModelIndex - 1 + models.length) % models.length;
        }
        updateModelTargets();
    }
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onClick(event) {
    if (isTransitioning) return;
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(models, true);
    if (intersects.length > 0) {
        const clickedModel = intersects[0].object.parent === neuralNetworkGroup ? neuralNetworkGroup : intersects[0].object;
        const clickedIndex = models.indexOf(clickedModel);
        if (clickedIndex !== -1 && clickedIndex !== currentModelIndex) {
            targetModelIndex = clickedIndex;
            updateModelTargets();
        }
    }
}

document.getElementById('modelCanvas').addEventListener('click', onClick);

function animate() {
    requestAnimationFrame(animate);
    models[0].rotation.x += 0.003; // Torus Knot
    models[0].rotation.y += 0.003;
    models[1].rotation.y += 0.002; // Neural Network
    models[2].rotation.x += 0.002; // Vertical rotation (around x-axis) for semi-complex function
    models[2].rotation.y += 0.003; // Horizontal rotation (around y-axis) for semi-complex function
    animateTransition();
    renderer.render(scene, camera);
}
models.forEach(model => scene.add(model));
initializeModelStates();
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    initializeModelStates();
});

// Dark mode toggle
const body = document.querySelector("body");
const toggleSwitch = document.getElementById("toggle-switch");
toggleSwitch.addEventListener("click", () => {
    body.classList.toggle("dark");
    localStorage.setItem("darkMode", body.classList.contains("dark"));
    const isDark = body.classList.contains("dark");
    const modelColor = isDark ? 0xffffff : 0x8749f2;
    const lineColor = isDark ? 0xffffff : 0x000000;
    torusMaterial.color.set(modelColor);
    neuronMaterial.color.set(isDark ? 0xffffff : 0xcc66ff);
    lineMaterial.color.set(lineColor);
    neuralMaterial.color.set(modelColor);
});

// Load dark mode preference
document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("darkMode") === "true") {
        body.classList.add("dark");
        torusMaterial.color.set(0xffffff);
        neuronMaterial.color.set(0xffffff);
        lineMaterial.color.set(0xffffff);
        neuralMaterial.color.set(0xffffff);
    } else {
        lineMaterial.color.set(0x000000);
    }
});

// Mobile menu toggle
function myMenuFunction() {
    const menuBtn = document.getElementById("myNavMenu");
    menuBtn.className = menuBtn.className === "nav-menu" ? "nav-menu responsive" : "nav-menu";
}

// Typed.js
try {
    const typingEffect = new Typed(".typedText", {
        strings: ["AI Specialist", "Machine Learning Enthusiast", "Full-Stack Developer", "Innovator"],
        loop: true,
        typeSpeed: 100,
        backSpeed: 80,
        backDelay: 2000
    });
} catch (error) {
    console.error("Typed.js failed to initialize:", error);
}

// ScrollReveal animations
try {
    const sr = ScrollReveal({
        origin: "top",
        distance: "80px",
        duration: 2000,
        reset: true
    });

    sr.reveal(".featured-name", { delay: 100 });
    sr.reveal(".text-info", { delay: 200 });
    sr.reveal(".text-btn", { delay: 200 });
    sr.reveal(".social_icons", { delay: 200 });
    sr.reveal(".project-box", { interval: 200 });
    sr.reveal(".cert-box", { interval: 200 });
    sr.reveal(".top-header", {});

    const srLeft = ScrollReveal({
        origin: "left",
        distance: "80px",
        duration: 2000,
        reset: true
    });
    srLeft.reveal(".about-info", { delay: 100 });
    srLeft.reveal(".contact-info", { delay: 100 });

    const srRight = ScrollReveal({
        origin: "right",
        distance: "80px",
        duration: 2000,
        reset: true
    });
    srRight.reveal(".skill", { delay: 100 });
    srRight.reveal(".skill-box", { delay: 100 });
} catch (error) {
    console.error("ScrollReveal failed to initialize:", error);
}

// Active navigation
const sections = document.querySelectorAll(".section[id]");
function scrollActive() {
    const scrollY = window.scrollY;
    sections.forEach((current) => {
        const sectionHeight = current.offsetHeight;
        const sectionTop = current.offsetTop - 50;
        const sectionId = current.getAttribute("id");
        const navLink = document.querySelector(`.nav-menu a[href="#${sectionId}"]`);
        if (navLink) {
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLink.classList.add("active-link");
            } else {
                navLink.classList.remove("active-link");
            }
        }
    });
}
window.addEventListener("scroll", scrollActive);

// Form submission
const contactForm = document.getElementById("contact-form");
if (contactForm) {
    contactForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            subject: document.getElementById("subject").value,
            message: document.getElementById("message").value
        };
        console.log("Form submitted:", formData);
        alert("Thank you for your message! I'll respond soon.");
        this.reset();
    });
}

// Additional functionality
document.addEventListener("DOMContentLoaded", () => {
    scrollActive();
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
            const menuBtn = document.getElementById("myNavMenu");
            if (menuBtn.classList.contains("responsive")) {
                menuBtn.className = "nav-menu";
            }
        });
    });

    document.querySelectorAll(".hire-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            window.location.href = "mailto:sashanksuperking@gmail.com?subject=Hiring Inquiry";
        });
    });
});