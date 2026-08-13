import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiX, FiZap, FiZapOff, FiHelpCircle } from "react-icons/fi";

const PHOTO_KEY = "shc-scan-photo";

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [query, setQuery] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot use the camera. Type the card name instead.");
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
        setError("Allow the camera, or go back and type the card name.");
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
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
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPhoto(dataUrl);
    try {
      sessionStorage.setItem(PHOTO_KEY, dataUrl);
    } catch {
      /* ignore quota */
    }
    stopCamera();
  };

  const handleSearch = (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}&from=scan`);
  };

  if (photo) {
    return (
      <div className="min-h-screen bg-navy text-white flex flex-col">
        <header className="relative flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold mx-auto">Nice photo!</h1>
          <Link
            to="/"
            className="absolute right-3 p-2 rounded-full min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Close"
          >
            <FiX size={24} />
          </Link>
        </header>
        <div className="px-4 pb-4">
          <img src={photo} alt="Your card" className="w-full max-h-72 object-contain rounded-2xl bg-black" />
        </div>
        <form onSubmit={handleSearch} className="flex-1 bg-white text-charcoal rounded-t-3xl p-5">
          <p className="text-xl font-bold text-navy mb-2">Type the player or card name.</p>
          <p className="text-charcoal mb-4">We saved your photo. Now tell us what to look up.</p>
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "Mahomes rookie"'
            className="w-full min-h-14 px-4 rounded-2xl border-2 border-charcoal-200 text-lg focus:outline-none focus:ring-2 focus:ring-baby-blue"
          />
          <button
            type="submit"
            className="mt-4 w-full min-h-14 rounded-2xl bg-black text-white font-bold text-lg"
          >
            Search
          </button>
          <Link to="/" className="mt-3 block text-center text-navy font-semibold py-3">
            Back home
          </Link>
        </form>
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
          onClick={() =>
            setHint("Fill the box with your card, then tap the round button.")
          }
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
        <Link
          to="/"
          onClick={stopCamera}
          className="text-white font-semibold underline underline-offset-4"
        >
          Type the card name instead
        </Link>
      </div>
    </div>
  );
}
