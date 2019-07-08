(function () {
    const Dimension = 768;
    const Steps = 30;

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aTextureCoord;
        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
        varying highp vec2 vTextureCoord;
        
        void main(void) {
          gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
          vTextureCoord = aTextureCoord;
        }
    `;

    const fsSource = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        
        highp vec4 thresholdColor(vec4 texelColor) {
            highp vec4 p = texelColor;
            p.rgb = (p.rgb * p.a) + (1.0 - p.a);
            p.a = 1.0;
                        
            highp float l = length(p.rgb);
            int a = 0;
            if (a == 0) {
                // Length of vector(1, 1, 1)
                // sqrt(3) = 1.73205080757
                if (l < 1.71) {
                    p = vec4(1, 0, 0, 1);
                } else {
                    p = vec4(0, 0, 0, 1);
                }
            } else {
                if ((p.r < 0.9) || (p.g < 0.9) || (p.b < 0.9)) {
                    p = vec4(1, 0, 0, 1);
                } else {
                    p = vec4(0, 0, 0, 1);
                }
            }
            return p;
        }
        
        void main(void) {
            gl_FragColor = thresholdColor(texture2D(uSampler, vTextureCoord));
            
            // gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
    `;

    const fsHorizontalBlur = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        
        void main(void) {
            highp vec4 texelColor = texture2D(uSampler, vTextureCoord);
            highp float sum = texelColor.r;
            const highp float step = 1.0 / ${Dimension}.0;
            const highp float limit = step * ${Steps}.0;

            for (highp float i = step; i < limit; i += step) {
                highp float x = vTextureCoord.x + i;
                highp vec4 p = texture2D(uSampler, vec2(x, vTextureCoord.y));
                sum = max(sum, p.r * (1.0 - i / limit));
            }
            
            for (highp float i = step; i < limit; i += step) {
                highp float x = vTextureCoord.x - i;
                highp vec4 p = texture2D(uSampler, vec2(x, vTextureCoord.y));
                sum = max(sum, p.r * (1.0 - i / limit));
            }
            
            gl_FragColor = vec4(sum, 0, 0, 1);
        }
    `;

    const fsVerticalBlur = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        
        void main(void) {
            highp vec4 texelColor = texture2D(uSampler, vTextureCoord);
            highp float sum = texelColor.r;
            const highp float step = 1.0 / ${Dimension}.0;
            const highp float limit = step * ${Steps}.0;

            for (highp float i = step; i < limit; i += step) {
                highp float y = vTextureCoord.y + i;
                highp vec4 p = texture2D(uSampler, vec2(vTextureCoord.x, y));
                sum = max(sum, p.r * (1.0 - i / limit));
            }
            
            for (highp float i = step; i < limit; i += step) {
                highp float y = vTextureCoord.y - i;
                highp vec4 p = texture2D(uSampler, vec2(vTextureCoord.x, y));
                sum = max(sum, p.r * (1.0 - i / limit));
            }
            
            highp vec4 out_color = vec4(sum, 0, 0, 1);
            if (sum < 1.0 && sum > 0.4) {
                out_color = vec4(1, 1, 1, 1);
            }
            gl_FragColor = out_color;
        }
    `;

    let frameBuffers = [];
    let textures = [];
    let buffers = null;
    let texture = null;
    let programInfo = null;

    function createAndSetupTexture(gl) {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Set up texture so we can render any size image and so we are
        // working with pixels.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        return texture;
    }

    function createFrameBuffers(gl) {
        for (var ii = 0; ii < 2; ++ii) {
            var texture = createAndSetupTexture(gl);
            textures.push(texture);

            const level = 0;
            const internalFormat = gl.RGBA;
            const srcFormat = gl.RGBA;
            gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, Dimension, Dimension, 0, srcFormat, gl.UNSIGNED_BYTE, null);

            // Create a framebuffer
            var fbo = gl.createFramebuffer();
            frameBuffers.push(fbo);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

            // Attach a texture to it.
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function main() {
        const canvas = document.querySelector('#glcanvas');
        const gl = canvas.getContext('webgl');

        if (!gl) {
            alert('Unable to initialize WebGL. Your browser or machine may not support it.');
            return;
        }

        const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
        const shaderProgram1 = initShaderProgram(gl, vsSource, fsHorizontalBlur);
        const shaderProgram2 = initShaderProgram(gl, vsSource, fsVerticalBlur);
        programInfo = [{
            program: shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
                uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            },
        }, {
            program: shaderProgram1,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram1, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(shaderProgram1, 'aTextureCoord'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(shaderProgram1, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(shaderProgram1, 'uModelViewMatrix'),
                uSampler: gl.getUniformLocation(shaderProgram1, 'uSampler'),
            },
        }, {
            program: shaderProgram2,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram2, 'aVertexPosition'),
                textureCoord: gl.getAttribLocation(shaderProgram2, 'aTextureCoord'),
            },
            uniformLocations: {
                projectionMatrix: gl.getUniformLocation(shaderProgram2, 'uProjectionMatrix'),
                modelViewMatrix: gl.getUniformLocation(shaderProgram2, 'uModelViewMatrix'),
                uSampler: gl.getUniformLocation(shaderProgram2, 'uSampler'),
            },
        }];

        buffers = initBuffers(gl);


        texture = loadTexture(gl, 'cubetexture-v2.png');
        // texture = loadTexture(gl, 'MomandKidGiraffe1.png');

        function render() {
            if (frameBuffers.length > 0) {
                drawScene(gl, programInfo);
            }
            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);
    }

    function initBuffers(gl) {
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

        const textureCoordinates = [
            0.0, 0.0,
            1.0, 0.0,
            1.0, 1.0,
            0.0, 1.0
        ];

        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        const indices = [
            0, 1, 2,
            0, 2, 3
        ];

        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
            indices: indexBuffer,
        };
    }

    function loadTexture(gl, url) {
        // Because images have to be download over the internet
        // they might take a moment until they are ready.
        // Until then put a single pixel in the texture so we can
        // use it immediately. When the image has finished downloading
        // we'll update the texture with the contents of the image.
        const level = 0;
        const internalFormat = gl.RGBA;
        const width = 1;
        const height = 1;
        const border = 0;
        const srcFormat = gl.RGBA;
        const srcType = gl.UNSIGNED_BYTE;

        const image = new Image();
        image.onload = function () {

            texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            // WebGL1 has different requirements for power of 2 images
            // vs non power of 2 images so check if the image is a
            // power of 2 in both dimensions.
            // if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            //     // Yes, it's a power of 2. Generate mips.
            //     gl.generateMipmap(gl.TEXTURE_2D);
            // } else {
            // No, it's not a power of 2. Turn of mips and set
            // wrapping to clamp to edge
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            // }

            createFrameBuffers(gl, image);
        };
        image.src = url;
    }

    function isPowerOf2(value) {
        return (value & (value - 1)) === 0;
    }

    function bindTexture(gl, texture, programInfo) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);
    }

    function bindProgram(gl, buffers, programInfo) {
        const zNear = 0.1;
        const zFar = 100.0;
        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, -1.0, 1.0, -1.0, 1.0, zNear, zFar);

        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -5.0]);

        // Tell WebGL how to pull out the positions from the position
        // buffer into the vertexPosition attribute
        {
            const numComponents = 3;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.vertexAttribPointer(
                programInfo.attribLocations.vertexPosition,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        }

        // Tell WebGL how to pull out the texture coordinates from
        // the texture coordinate buffer into the textureCoord attribute.
        {
            const numComponents = 2;
            const type = gl.FLOAT;
            const normalize = false;
            const stride = 0;
            const offset = 0;
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
            gl.vertexAttribPointer(
                programInfo.attribLocations.textureCoord,
                numComponents,
                type,
                normalize,
                stride,
                offset);
            gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.useProgram(programInfo.program);

        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
    }

    function drawScene(gl, programInfo) {
        var el = document.getElementById('glprogram');
        var p = el.value - 0;

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        if (p === 0) {
            {
                let pi = programInfo[0];
                bindProgram(gl, buffers, pi);
                bindTexture(gl, texture, pi);

                const vertexCount = 6;
                const type = gl.UNSIGNED_SHORT;
                const offset = 0;
                gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[0]);
                // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
            }

            {
                let pi = programInfo[1];
                bindProgram(gl, buffers, pi);
                bindTexture(gl, textures[0], pi);

                const vertexCount = 6;
                const type = gl.UNSIGNED_SHORT;
                const offset = 0;
                gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[1]);
                gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
            }
            {
                let pi = programInfo[2];
                bindProgram(gl, buffers, pi);
                bindTexture(gl, textures[1], pi);

                const vertexCount = 6;
                const type = gl.UNSIGNED_SHORT;
                const offset = 0;
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
            }
        } else {
            {
                let pi = programInfo[0];
                bindProgram(gl, buffers, pi);
                bindTexture(gl, texture, pi);

                const vertexCount = 6;
                const type = gl.UNSIGNED_SHORT;
                const offset = 0;
                // gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffers[0]);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
            }
        }
    }

    function initShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();

        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }

        return shaderProgram;
    }

    function loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    main();

    function loadInputImage() {
        window.onload = function () {
            var canvas = document.getElementById("glcanvas");
            var ctx = canvas.getContext("2d");
            var img = document.getElementById("input-img");
            var aspect = img.width / img.height;
            var d = 32;
            var imgDim = Dimension - 2 * d;
            var value = Math.max(img.width, img.height);
            var iw, ih;
            if (aspect > 0) {
                iw = imgDim;
                ih = iw / aspect;
            } else {
                ih = imgDim;
                iw = aspect * ih;
            }

            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0,0,canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, img.width, img.height, d, d, imgDim, imgDim);
        };
    }

    // loadInputImage();
})();
