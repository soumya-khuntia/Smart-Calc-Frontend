import { useEffect, useRef, useState } from "react";
import { SWATCHES } from "@/constants";
import { ColorSwatch, Group } from "@mantine/core";
import { Button } from "@/components/ui/button";
import Draggable from "react-draggable";
import axios from "axios";

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

interface GeneratedResult {
  expression: string;
  answer: string;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [result, setResult] = useState<GeneratedResult>();
  const [dictOfVars, setDictOfVars] = useState({});
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpression, setLatexExpression] = useState<Array<string>>([]);
  const [isErasing, setIsErasing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);


  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpression([]);
      setResult(undefined);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }, 0);
    }
  }, [latexExpression]);

  useEffect(() => {
    if (result) {
      renderLatexToCanvas(result.expression, result.answer);
    }
  }, [result]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
    setLatexExpression([...latexExpression, latex]);

    // Clear the main canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const runRoute = async () => {
    setIsCalculating(true);
    const canvas = canvasRef.current;

    if (canvas) {
      try {
        const response = await axios({
          method: "post",
          url: `${import.meta.env.VITE_API_URL}/calculate`,
          data: {
            image: canvas.toDataURL("image/png"),
            dict_of_vars: dictOfVars,
          },
        });

        const resp = await response.data;
        console.log("Response", resp);
        resp.data.forEach((data: Response) => {
          if (data.assign === true) {
            // dict_of_vars[resp.result] = resp.answer;
            setDictOfVars({
              ...dictOfVars,
              [data.expr]: data.result,
            });
          }
        });
        const ctx = canvas.getContext("2d");
        const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
        let minX = canvas.width,
          minY = canvas.height,
          maxX = 0,
          maxY = 0;

        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (imageData.data[i + 3] > 0) {
              // If pixel is not transparent
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        setLatexPosition({ x: centerX, y: centerY });
        resp.data.forEach((data: Response) => {
          setTimeout(() => {
            setResult({
              expression: data.expr,
              answer: data.result,
            });
          }, 1000);
        });
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsCalculating(false);
      }
    }
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.background = "black";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setIsDrawing(true);
      }
    }
  };
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (isErasing) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = 20; // Adjust eraser size as needed
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = color;
          ctx.lineWidth = 3;
        }
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      }
    }
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  };
  

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-2">
        <div className="flex space-x-2 sm:col-span-2 md:col-span-1">
          <Button
            onClick={() => setReset(true)}
            className="z-20 bg-gray-500 text-white w-1/2 rounded-full"
            variant="default"
            color="black"
          >
            Reset
          </Button>
          <Button
            onClick={() => setIsErasing(!isErasing)}
            className={`z-20 rounded-full w-1/2 ${
              isErasing ? "bg-green-500" : "bg-red-500"
            } text-white`}
            variant="default"
            color="black"
          >
            {isErasing ? "Eraser On" : "Eraser Off"}
          </Button>
        </div>
        <Group className="z-20 cursor-pointer flex justify-center">
          {SWATCHES.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              onClick={() => setColor(swatch)}
              className="w-6 h-6 sm:w-8 sm:h-8"
            />
          ))}
        </Group>
        <Button
          onClick={runRoute}
          className={`z-20 bg-blue-600 text-white w-full sm:w-1/2 rounded-full ${isCalculating ? "opacity-50 cursor-not-allowed" : ""}`}
          variant="default"
          color="white"
          disabled={isCalculating}
        >
          {isCalculating ? "Calculating..." : "Run"}
        </Button>
      </div>


      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute top-0 left-0 w-full h-full"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />

      {latexExpression &&
        latexExpression.map((latex, index) => (
          <Draggable
            key={index}
            defaultPosition={latexPosition}
            onStop={(e, data) => setLatexPosition({ x: data.x, y: data.y })}
          >
            <div className="absolute p-2 text-white rounded shadow-md cursor-pointer">
              <div className="latex-content text-sm sm:text-base md:text-lg">{latex}</div>
            </div>
          </Draggable>
        ))}
    </>
  );
}