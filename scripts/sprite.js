VS_01 = `#version 300 es
    in vec2 a_position;
    in vec2 a_texCoord;

    uniform float u_depth;
    uniform mat3 u_world;
    uniform mat3 u_object;
    uniform vec2 u_frame;

    out vec2 texCoord;
    void main(){
        gl_Position = vec4((u_world * u_object * vec3(a_position, 1)).xy, u_depth, u_depth);
        texCoord = a_texCoord + u_frame;
    }
`;

FS_01 = `#version 300 es
    precision mediump float;

    in vec2 texCoord;

    uniform sampler2D u_image;

    out vec4 fragmentColor;
    
    void main(){
        fragmentColor = texture(u_image, texCoord);
    }
`;

class Sprite {
    constructor(layer, img_url, options = {}) {
        var me = this;

        me.ID = GENERATE_ID(); // util.js
        me.layer = layer;
        me.canvas = me.layer.canvas;
        me.gl = me.canvas.gl;

        me.isLoaded = false;
        me.material = new Material(me.gl, VS_01, FS_01);
        me.image = new Image();
        me.image.src = img_url;

        me.size = ("size" in options) ? options.size : new Point(64, 64);
        me.scale = ("scale" in options) ? options.scale : new Point(1, 1);
        me.frame = ("frame" in options) ? options.frame : new Point();
        me.position = ("position" in options) ? options.positions : new Point();
        if ("x" in options) { me.position.x = options.x; }
        if ("y" in options) { me.position.y = options.y; }

        me.image.onload = function () {
            me.init();
        }
    }

    init() {
        let gl = this.gl;

        gl.useProgram(this.material.program);

        this.objectMatrix = mat3.create();

        this.gl_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.gl_tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); // maybe change to bilinear?
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // maybe change to bilinear
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.uv_x = this.size.x / this.image.width;
        this.uv_y = this.size.y / this.image.height;
        this.uv_frame = new Point(
            Math.floor(this.frame.x) * this.uv_x,
            Math.floor(this.frame.y) * this.uv_y
        );

        this.tex_buff = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
        gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(0, 0, this.uv_x, this.uv_y), gl.STATIC_DRAW);

        this.geo_buff = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
        gl.bufferData(gl.ARRAY_BUFFER, Sprite.createRectArray(0, 0, this.size.x, this.size.y), gl.STATIC_DRAW);

        gl.useProgram(null);
        this.isLoaded = true;
        this.update();
    }

    static createRectArray(x = 0, y = 0, w = 1, h = 1) {
        return new Float32Array([
            x, y,
            x + w, y,
            x, y + h,
            x, y + h,
            x + w, y,
            x + w, y + h
        ]);
    }

    destroy() {
        let gl = this.gl;
        this.isLoaded = false

        gl.deleteBuffer(this.tex_buff)
        gl.deleteBuffer(this.geo_buff)
        gl.deleteTexture(this.gl_tex)
        gl.deleteProgram(this.material.program)
    }

    update() {
        if (this.isLoaded) {
            // scale
            mat3.scale(this.objectMatrix, mat3.identity, [this.scale, this.scale]);

            // translate
            mat3.translate(
                this.objectMatrix,
                this.objectMatrix,
                [this.position.x, this.position.y]);

            // frame
            this.uv_frame.x = Math.floor(this.frame.x) * this.uv_x;
            this.uv_frame.y = Math.floor(this.frame.y) * this.uv_y;
        }
    }

    render() {
        if (this.isLoaded) {
            let gl = this.gl;

            gl.useProgram(this.material.program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.gl_tex);
            this.material.set("u_image", 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.tex_buff);
            this.material.set("a_texCoord");
            gl.bindBuffer(gl.ARRAY_BUFFER, this.geo_buff);
            this.material.set("a_position");
            this.material.set("u_frame", this.uv_frame.x, this.uv_frame.y);
            this.material.set("u_world", this.layer.worldSpaceMatrix);
            this.material.set("u_object", this.objectMatrix);
            this.material.set("u_depth", this.layer.depth);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6);
            gl.useProgram(null);
        }
    }
}