import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiX, FiZap, FiZapOff, FiHelpCircle } from "react-icons/fi";
import RecognitionCandidates from "../components/RecognitionCandidates.jsx";

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const previewRef = useRef(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState("camera");
  const [result, setResult] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    previewRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    if (imageFile) return undefined;
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot use the camera. Choose a photo instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() || {};
        setTorchSupported(Boolean(capabilities.torch));
      } catch {
        setError("Allow the camera, or choose a photo.");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [imageFile]);

  useEffect(() => {
    if (!imageFile) return undefined;
    let cancelled = false;

    const identify = async () => {
      setStatus("identifying");
      setError("");
      setResult(null);
      const body = new FormData();
      body.append("image", imageFile);
      try {
        const res = await fetch("/api/recognition/cards", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || "We couldn't identify that photo.");
        }
        if (!cancelled) {
          setResult(json);
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err.message || "We couldn't identify that photo.");
        }
      }
    };

    identify();
    return () => {
      cancelled = true;
    };
  }, [imageFile]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const selectImage = (file) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    stopCamera();
  };

  const resetPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageFile(null);
    setResult(null);
    setStatus("camera");
    setError("");
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn((on) => !on);
    } catch {
      setTorchSupported(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        selectImage(new File([blob], "scan.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.85
    );
  };

  const onChoosePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) selectImage(file);
  };

  const confirmCandidate = (candidate) => {
    if (candidate.resolutionStatus === "resolved" && candidate.canonicalCardId) {
      navigate(`/card/${encodeURIComponent(candidate.canonicalCardId)}`);
      return;
    }
    const query = [candidate.name, candidate.cardNumber].filter(Boolean).join(" ");
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  };

  if (previewUrl) {
    const candidates = result?.candidates || [];
    return (
      <div className="min-h-screen bg-navy text-white flex flex-col">
        <header className="relative flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold mx-auto">
            {status === "identifying" ? "Looking at your card" : "Check this card"}
          </h1>
          <Link
            to="/"
            className="absolute right-3 p-2 rounded-full min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Close"
          >
            <FiX size={24} />
          </Link>
        </header>
        <div className="px-4 pb-4">
          <img src={previewUrl} alt="Your card" className="w-full max-h-72 object-contain rounded-2xl bg-black" />
        </div>
        <div className="flex-1 bg-white text-charcoal rounded-t-3xl p-5">
          {status === "identifying" && <p className="text-lg font-semibold text-navy">Identifying the card…</p>}
          {status === "error" && (
            <div>
              <p className="text-lg font-semibold text-navy">{error}</p>
              <button type="button" onClick={resetPhoto} className="mt-4 w-full min-h-14 rounded-2xl bg-black text-white font-bold text-lg">
                Try another photo
              </button>
              <Link to="/search" className="mt-3 block text-center text-navy font-semibold py-3">
                Search by name
              </Link>
            </div>
          )}
          {status === "ready" && result?.outcome === "no_card_detected" && (
            <div>
              <p className="text-lg font-semibold text-navy">We couldn't find a card in that photo.</p>
              <button type="button" onClick={resetPhoto} className="mt-4 w-full min-h-14 rounded-2xl bg-black text-white font-bold text-lg">
                Try another photo
              </button>
              <Link to="/search" className="mt-3 block text-center text-navy font-semibold py-3">
                Search by name
              </Link>
            </div>
          )}
          {status === "ready" && candidates.length > 0 && (
            <RecognitionCandidates
              candidates={candidates}
              onConfirm={confirmCandidate}
              onNone={() => navigate("/search")}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <header className="absolute top-0 inset-x-0 z-20 flex items-center justify-center px-4 py-4">
        <h1 className="text-lg font-bold">Scan a card</h1>
        <Link
          to="/"
          onClick={stopCamera}
          className="absolute right-3 p-2 rounded-full min-h-11 min-w-11 flex items-center justify-center bg-black/40"
          aria-label="Close"
        >
          <FiX size={24} />
        </Link>
      </header>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="relative w-[78%] max-w-sm aspect-[3/4]">
          <span className="absolute top-0 left-0 h-10 w-10 border-t-4 border-l-4 border-baby-blue rounded-tl-md" />
          <span className="absolute top-0 right-0 h-10 w-10 border-t-4 border-r-4 border-baby-blue rounded-tr-md" />
          <span className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4 border-baby-blue rounded-bl-md" />
          <span className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4 border-baby-blue rounded-br-md" />
        </div>
      </div>

      <div className="absolute right-4 top-24 z-20 flex flex-col gap-3">
        <button
          type="button"
          className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center"
          aria-label="Help"
          onClick={() => setHint("Fill the box with your card, then tap the round button.")}
        >
          <FiHelpCircle size={22} />
        </button>
        {torchSupported && (
          <button
            type="button"
            onClick={toggleTorch}
            className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center"
            aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
          >
            {torchOn ? <FiZap size={22} /> : <FiZapOff size={22} />}
          </button>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 z-20 pb-8 px-4 flex flex-col items-center gap-4">
        <p className="bg-charcoal/80 text-white px-4 py-2 rounded-full text-sm font-semibold">
          Fill the box with your card
        </p>
        {(error || hint) && (
          <p className="bg-white text-navy px-4 py-3 rounded-2xl text-center font-semibold max-w-sm">
            {error || hint}
          </p>
        )}
        <button
          type="button"
          onClick={takePhoto}
          disabled={!cameraReady}
          className="h-20 w-20 rounded-full bg-white border-4 border-baby-blue focus:outline-none focus:ring-2 focus:ring-baby-blue disabled:opacity-40"
          aria-label="Take photo"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onChoosePhoto}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="min-h-12 px-5 rounded-full bg-white text-navy font-bold"
        >
          Choose Photo
        </button>
        <Link to="/search" onClick={stopCamera} className="text-white font-semibold underline underline-offset-4">
          Type the card name instead
        </Link>
      </div>
    </div>
  );
}
