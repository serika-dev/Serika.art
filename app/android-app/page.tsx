'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaAndroid, FaDownload, FaGithub, FaCheckCircle, FaMobileAlt, FaShieldAlt, FaBolt } from 'react-icons/fa';

interface Release {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  assets: {
    name: string;
    browser_download_url: string;
    size: number;
  }[];
}

export default function AndroidAppPage() {
  const [latestRelease, setLatestRelease] = useState<Release | null>(null);
  const [nightlyRelease, setNightlyRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReleases() {
      try {
        const res = await fetch('https://api.github.com/repos/your-username/Serika.art/releases');
        const releases: Release[] = await res.json();
        
        // Find latest stable release (not prerelease, not nightly)
        const stable = releases.find(r => !r.prerelease && r.tag_name !== 'nightly');
        if (stable) setLatestRelease(stable);
        
        // Find nightly release
        const nightly = releases.find(r => r.tag_name === 'nightly');
        if (nightly) setNightlyRelease(nightly);
      } catch (error) {
        console.error('Failed to fetch releases:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchReleases();
  }, []);

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getApkAsset = (release: Release) => {
    return release.assets.find(a => a.name.endsWith('.apk'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-pink-600/20" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 sm:py-32">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 mb-8">
              <FaAndroid className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              Serika.art for Android
            </h1>
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              Browse, discover, and save your favorite artwork on the go with our native Android app.
            </p>
            
            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {loading ? (
                <div className="animate-pulse bg-zinc-800 rounded-xl h-14 w-48" />
              ) : latestRelease ? (
                <a
                  href={getApkAsset(latestRelease)?.browser_download_url}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-violet-500/25"
                >
                  <FaDownload className="w-5 h-5" />
                  Download v{latestRelease.tag_name.replace('v', '')}
                </a>
              ) : (
                <a
                  href="https://github.com/your-username/Serika.art/releases"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg shadow-violet-500/25"
                >
                  <FaGithub className="w-5 h-5" />
                  View Releases
                </a>
              )}
              
              <a
                href="https://github.com/your-username/Serika.art/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition-colors"
              >
                <FaGithub className="w-5 h-5" />
                All Releases
              </a>
            </div>

            {latestRelease && (
              <p className="mt-4 text-sm text-zinc-500">
                Released {formatDate(latestRelease.published_at)} • {formatSize(getApkAsset(latestRelease)?.size || 0)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">Features</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<FaBolt className="w-6 h-6" />}
            title="Fast & Native"
            description="Built with Kotlin and Jetpack Compose for smooth, responsive performance."
          />
          <FeatureCard
            icon={<FaMobileAlt className="w-6 h-6" />}
            title="Material Design 3"
            description="Modern UI following the latest Material You design guidelines."
          />
          <FeatureCard
            icon={<FaShieldAlt className="w-6 h-6" />}
            title="Content Filters"
            description="Control what you see with customizable rating and AI content filters."
          />
        </div>
      </div>

      {/* Screenshots Section */}
      <div className="bg-zinc-900/50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">Screenshots</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-[9/19] bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-600"
              >
                <span className="text-sm">Screenshot {i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Installation Guide */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-12">How to Install</h2>
        <div className="space-y-6">
          <InstallStep
            number={1}
            title="Download the APK"
            description="Click the download button above to get the latest version of the app."
          />
          <InstallStep
            number={2}
            title="Enable Unknown Sources"
            description="Go to Settings → Security → Install unknown apps, and enable it for your browser or file manager."
          />
          <InstallStep
            number={3}
            title="Install the App"
            description="Open the downloaded APK file and tap Install. You may need to confirm the installation."
          />
          <InstallStep
            number={4}
            title="Open and Enjoy"
            description="Find the Serika.art app in your app drawer and start browsing!"
          />
        </div>
      </div>

      {/* Nightly Builds Section */}
      {nightlyRelease && (
        <div className="bg-zinc-900/50 py-16">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <FaAndroid className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">Nightly Builds</h3>
                  <p className="text-zinc-400 text-sm mb-4">
                    Want to try the latest features? Download our nightly builds. These are automatically built from the latest code and may be unstable.
                  </p>
                  <a
                    href={getApkAsset(nightlyRelease)?.browser_download_url}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-sm font-medium transition-colors"
                  >
                    <FaDownload className="w-4 h-4" />
                    Download Nightly
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirements */}
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-8">Requirements</h2>
        <div className="bg-zinc-800/50 rounded-2xl p-6">
          <ul className="space-y-3">
            <RequirementItem text="Android 8.0 (Oreo) or higher" />
            <RequirementItem text="~50 MB of storage space" />
            <RequirementItem text="Internet connection" />
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>
            <Link href="/" className="text-violet-400 hover:text-violet-300">
              Serika.art
            </Link>
            {' '}• Android app is open source on{' '}
            <a
              href="https://github.com/your-username/Serika.art"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-2xl p-6 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-500/20 text-violet-400 mb-4">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm">{description}</p>
    </div>
  );
}

function InstallStep({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-zinc-400 text-sm">{description}</p>
      </div>
    </div>
  );
}

function RequirementItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <FaCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      <span>{text}</span>
    </li>
  );
}
