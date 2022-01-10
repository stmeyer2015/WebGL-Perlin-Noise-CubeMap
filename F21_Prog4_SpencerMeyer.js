/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */
 //License From Noise Generation Library Used
"use strict";
var canvas;
var gl;
var program1, program2;
var framebuffer, renderbuffer;
var modelViewMatrixLoc1, projectionMatrixLoc1;
var modelViewMatrixLoc2, projectionMatrixLoc2;
var texSize = 250;
var numComponents = 4;
var texture1; 
var modelViewMatrix, projectionMatrix, nMatrix;
var flag = false;
var cubeMap;
var vertexColors = [
        vec4(0.0, 0.0, 0.0, 1.0),  
        vec4(0.3, 0.3, 0.3, 1.0),  
        vec4(0.4, 0.4, 0.4, 1.0),  
        vec4(0.2, 0.2, 0.2, 1.0),  
    ];
var positionsArray = [];
var normalsArray = [];
var colorsArray = [];
//Cone Vars
var numTimesToSubdivide = 1000;
var sideStartIndex = 0;
var sideEndIndex = 0;
var topStartIndex = 0;
var topEndIndex = 0;
var bottomStartIndex = 0;
var bottomEndIndex = 0;
var cRadius = 0.5;
var cHeight = 1.0;
var bottomIndex = 0;
var unitCircleVertices = [];
var cylinderIndicies = []
var coneStartIndex = 0;
var coneEndIndex = 0;
var baseCenterIndex = 0;
var topCenterIndex = 0;
var bottomCircleVertices = [];
var topCircleVertices = [];
//Transformation Vars
var xAxis = 0;
var yAxis = 1;
var zAxis = 2;
var axis = xAxis;
var cycScale = [1.0, 1.5, 1.0];
var theta = vec3(0.0, 0.0, 0.0);
//Image Vars
var imageRed, imageGreen, imageBlue, imageCyan, imageMagenta, imageYellow;
var uTime = 0.0;
var color = 0;
var simplexScale = vec3(10, 10, 100);
var perlinScale = vec3(100, 100, 100);
var toggleSimplex = true;
var togglePerlin = false;

init();
function renderImages()
{
    uTime += 1;
    imageRed = new Uint8Array(numComponents*texSize*texSize);
    imageGreen = new Uint8Array(numComponents*texSize*texSize);
    imageBlue = new Uint8Array(numComponents*texSize*texSize);
    imageCyan = new Uint8Array(numComponents*texSize*texSize);
    imageMagenta = new Uint8Array(numComponents*texSize*texSize);
    imageYellow = new Uint8Array(numComponents*texSize*texSize);
    for(var i=0; i<texSize; i++)
    {
        for(var j=0; j<texSize; j++)
        {
            var x = i-texSize/2;
            var y = j-texSize/2;
            if(toggleSimplex) color = noise.simplex3(x/simplexScale[0],y/simplexScale[1], uTime/simplexScale[2]);
            if(togglePerlin) color = noise.perlin3(x/perlinScale[0], y/perlinScale[1], color/perlinScale[2]);
            if((togglePerlin) && (!toggleSimplex)) color = noise.perlin3(x/perlinScale[0], y/perlinScale[1], uTime/perlinScale[2]);
            color = Math.abs(color)*255;
            var index = numComponents*(i*texSize+j);
            //Red Image
            imageRed[index] = color;
            imageRed[index+1] =  0;
            imageRed[index+2] =  0;
            imageRed[index+3] = 255;
            //Green Image
            imageGreen[index] = 0;
            imageGreen[index+1] =  color;
            imageGreen[index+2] =  0;
            imageGreen[index+3] = 255;
            //Blue Image
            imageBlue[index] = 0;
            imageBlue[index+1] =  0;
            imageBlue[index+2] =  color;
            imageBlue[index+3] = 255;
            //Red Image
            imageCyan[index] = 0;
            imageCyan[index+1] =  color;
            imageCyan[index+2] =  color;
            imageCyan[index+3] = 255;
            //Red Image
            imageMagenta[index] = color;
            imageMagenta[index+1] =  0;
            imageMagenta[index+2] =  color;
            imageMagenta[index+3] = 255;
            //Red Image
            imageYellow[index] = color;
            imageYellow[index+1] =  color;
            imageYellow[index+2] =  0;
            imageYellow[index+3] = 255;
        }
    }
 
}

function configureCubeMap() 
{
    renderImages();
    cubeMap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeMap);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageRed);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageGreen);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageBlue);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageCyan);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageMagenta);
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z ,0,gl.RGBA,texSize,texSize,0,gl.RGBA,gl.UNSIGNED_BYTE, imageYellow);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
}

function init() {
    canvas = document.getElementById("gl-canvas");

    gl = canvas.getContext('webgl2');
    if (!gl) alert("WebGL 2.0 isn't available");
// //Create an empty texture

    //
    //  Load shaders and initialize attribute buffers
    //
    program1 = initShaders(gl, "vertex-shader1", "fragment-shader1");
    program2 = initShaders(gl, "vertex-shader2", "fragment-shader2");
    gl.useProgram(program1);
    
    generateCylinder();

    var nBuffer1 = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer1);
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );

    var normalLoc1 = gl.getAttribLocation( program1, "aNormal");
    gl.vertexAttribPointer( normalLoc1, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray( normalLoc1);

    var cBuffer1 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer1);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    var vBuffer1 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer1);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    var positionLoc1 = gl.getAttribLocation( program1, "aPosition");
    gl.vertexAttribPointer(positionLoc1, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc1);

    var cBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colorsArray), gl.STATIC_DRAW);

    var colorLoc2 = gl.getAttribLocation(program2, "aColor");
    gl.vertexAttribPointer(colorLoc2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(colorLoc2);

    var vBuffer2 = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer2);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(positionsArray), gl.STATIC_DRAW);

    var positionLoc2 = gl.getAttribLocation(program2, "aPosition");
    gl.vertexAttribPointer(positionLoc2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc2);

    document.getElementById("ButtonX").onclick = function(){axis = xAxis;};
    document.getElementById("ButtonY").onclick = function(){axis = yAxis;};
    document.getElementById("ButtonZ").onclick = function(){axis = zAxis;};
    document.getElementById("ButtonT").onclick = function(){flag = !flag;};
    document.getElementById("meshCount").onchange = function(event){numTimesToSubdivide = event.target.value; init();}
    document.getElementById("scaleY").onchange = function(event){cycScale[1] = event.target.value;}
    document.getElementById("sx").onchange = function(event) {simplexScale[0] = event.target.value;}
    document.getElementById("sy").onchange = function(event) {simplexScale[1] = event.target.value;}
    document.getElementById("st").onchange = function(event) {simplexScale[2] = event.target.value;}
    document.getElementById("px").onchange = function(event) {perlinScale[0] = event.target.value;}
    document.getElementById("py").onchange = function(event) {perlinScale[1] = event.target.value;}
    document.getElementById("pt").onchange = function(event) {perlinScale[2] = event.target.value;}
    document.getElementById("toggleS").onclick = function(){toggleSimplex = !toggleSimplex;}
    document.getElementById("toggleP").onclick = function(){togglePerlin = !togglePerlin;}
    document.getElementById("resolution").onchange = function(event) {texSize = event.target.value;}

    projectionMatrix = ortho(-2, 2, -2, 2, -5, 5);

    configureCubeMap();
    gl.useProgram(program1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(gl.getUniformLocation(program1, "uTexMap"),0);
    gl.uniformMatrix4fv(gl.getUniformLocation(program1, "uProjectionMatrix" ), false, flatten(projectionMatrix)  );
    
    gl.useProgram(program2);
    gl.uniformMatrix4fv(gl.getUniformLocation(program2, "uProjectionMatrix" ), false, flatten(projectionMatrix)  );
    gl.enable(gl.DEPTH_TEST);
    render();
}

function render()
{
    gl.viewport(0, 0, canvas.width/2, canvas.height);
    gl.clearColor(0.8, 0.8, 0.8, 1.0);
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    transformations();
    

    gl.useProgram(program1);
    configureCubeMap();
    gl.uniformMatrix4fv(gl.getUniformLocation(program1, "uModelViewMatrix"), false, flatten(modelViewMatrix));
    for( var i=sideStartIndex; i<sideEndIndex; i+=3)
        gl.drawArrays(gl.TRIANGLES, i, 3);
    gl.drawArrays(gl.TRIANGLE_FAN, topStartIndex, topEndIndex-topStartIndex);
    gl.drawArrays(gl.TRIANGLE_FAN, bottomStartIndex, bottomEndIndex-bottomStartIndex);


    gl.viewport(canvas.width/2, 0, canvas.width/2, canvas.height);
    gl.useProgram(program2);  
    gl.uniformMatrix4fv(gl.getUniformLocation(program2, "uModelViewMatrix"), false, flatten(modelViewMatrix));
    for( var i=sideStartIndex; i<sideEndIndex; i+=3)
        gl.drawArrays(gl.TRIANGLES, i, 3);
    gl.drawArrays(gl.TRIANGLE_FAN, topStartIndex, topEndIndex-topStartIndex);
    gl.drawArrays(gl.TRIANGLE_FAN, bottomStartIndex, bottomEndIndex-bottomStartIndex);
    requestAnimationFrame(render);
}

function transformations()
{
    if(flag) theta[axis] += 0.5;

    var eye = vec3(0.0, 0.0, 1.0);
    var at = vec3(0.0, 0.0, 0.0);
    var up = vec3(0.0, 1.0, 0.0);

    modelViewMatrix = lookAt(eye, at, up);
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[xAxis], vec3(1, 0, 0)));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[yAxis], vec3(0, 1, 0)));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[zAxis], vec3(0, 0, 1)));
    modelViewMatrix = mult(modelViewMatrix, scale(cycScale[0], cycScale[1], cycScale[2]));
}

function quad(a, b, c, d) 
{
     var t1 = subtract(b, a);
     var t2 = subtract(c, a);

     var temp = cross(t1, t2);
     var normal = vec4(temp[0], temp[1], temp[2], 0.0);

     positionsArray.push(a);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2]);

     positionsArray.push(c);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2]);

     positionsArray.push(b);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2]);

     positionsArray.push(a);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2]);

     positionsArray.push(d);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2]);
 
     positionsArray.push(c);
     normalsArray.push(normal);
     colorsArray.push(vertexColors[2])
}

function generateCircleVerts()
{
    topCircleVertices = [];
    bottomCircleVertices = [];
    var PI = 3.1415926;
    var sectorStep = 2 * PI / numTimesToSubdivide;
    var sectorAngle;
    for(var i =  0; i < numTimesToSubdivide; i++)
    {
        sectorAngle = i * sectorStep;
        var x = (Math.cos(sectorAngle))*cRadius;
        var z = (Math.sin(sectorAngle))*cRadius;
        var y = (-cHeight);
        bottomCircleVertices.push(vec4(x,y,z,1.0))

    }

    for(var i =  0; i < numTimesToSubdivide; i++)
    {
        sectorAngle = i * sectorStep;
        var x = (Math.cos(sectorAngle))*cRadius;
        var z = (Math.sin(sectorAngle))*cRadius;
        var y = (cHeight);
        topCircleVertices.push(vec4(x,y,z,1.0))
    }
}

function generateCylinder()
{
    positionsArray = [];
    normalsArray = [];
    colorsArray = [];
    sideStartIndex = positionsArray.length;
    generateCircleVerts();
    for(var i = 0; i < topCircleVertices.length - 1; i++)
    {
        var A = bottomCircleVertices[i];
        var B = topCircleVertices[i];
        var C = topCircleVertices[i+1];
        var D = bottomCircleVertices[i+1];
        quad(A,B,C,D)
    }
    quad(bottomCircleVertices[bottomCircleVertices.length-1], topCircleVertices[topCircleVertices.length-1], topCircleVertices[0], bottomCircleVertices[0])
    sideEndIndex = positionsArray.length;
    generateFaces();
}

function generateFaces()
{
    var topNormal = vec3(0.0, 1.0, 0.0);
    var bottomNormal = vec3(0.0, -1.0, 0.0);
    topStartIndex = positionsArray.length;
    positionsArray.push(vec4(0.0, cHeight, 0.0, 1.0))
    normalsArray.push(topNormal);
    colorsArray.push(vertexColors[3]);
    for(var i =  0; i < topCircleVertices.length; i++)
    {
        positionsArray.push(topCircleVertices[i]);
        normalsArray.push(topNormal);
        colorsArray.push(vertexColors[3]);
    }
    positionsArray.push(topCircleVertices[0]);
    normalsArray.push(topNormal);
    colorsArray.push(vertexColors[3]);
    topEndIndex = positionsArray.length;

    bottomStartIndex = positionsArray.length;
    positionsArray.push(vec4(0.0, -cHeight, 0.0, 1.0))
    normalsArray.push(bottomNormal);
    colorsArray.push(vertexColors[1]);
    for(var i =  0; i < bottomCircleVertices.length; i++)
    {
        positionsArray.push(bottomCircleVertices[i]);
        normalsArray.push(bottomNormal);
        colorsArray.push(vertexColors[1]);
    }
    positionsArray.push(bottomCircleVertices[0]);
    normalsArray.push(bottomNormal);
    colorsArray.push(vertexColors[1]);
    bottomEndIndex = positionsArray.length;
}
