// soemdsp-native-module: noise_generator
// soemdsp-native-label: Noise Generator
// soemdsp-native-target: noiseGenerator
// soemdsp-native-kind: noise

namespace {

static const int kMaxInstances = 16;

struct NoiseChan {
  unsigned int seed;
  double brown;
  double pink[7];
};

struct NoiseGenState {
  NoiseChan left;
  NoiseChan right;
  int currentSeed;
  bool active;
  double lastLeft;
  double lastRight;
};

static NoiseGenState gPool[kMaxInstances];

static unsigned int seedHash(int seed, int channel) {
  unsigned int h = (unsigned int)(seed ^ (channel * 0x9e3779b9));
  h ^= h >> 16;
  h = h * 0x45d9f3bU;
  h ^= h >> 16;
  h = h * 0x45d9f3bU;
  h ^= h >> 16;
  return h ? h : 1U;
}

static void resetChan(NoiseChan& chan, unsigned int initialSeed) {
  chan.seed = initialSeed;
  chan.brown = 0.0;
  for (int i = 0; i < 7; i++) chan.pink[i] = 0.0;
}

static unsigned int lcgNext(NoiseChan& chan) {
  chan.seed = 1664525U * chan.seed + 1013904223U;
  return chan.seed;
}

static double nextBipolar(NoiseChan& chan) {
  return (double)(lcgNext(chan)) / (double)(0xffffffffU) * 2.0 - 1.0;
}

static double nextUnipolar(NoiseChan& chan) {
  return (double)(lcgNext(chan)) / (double)(0xffffffffU);
}

static double nextGaussian(NoiseChan& chan) {
  // CLT approximation: sum of 12 uniforms ≈ N(6, 1), shifted to N(0, 1)
  double sum = 0.0;
  for (int i = 0; i < 12; i++) sum += nextUnipolar(chan);
  return sum - 6.0;
}

static double clamp(double v, double lo, double hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static double channelSample(NoiseChan& chan, int mode, double mean, double deviation) {
  const double white = nextBipolar(chan);
  if (mode == 1) {
    return mean + nextGaussian(chan) * deviation;
  }
  if (mode == 2) {
    const double dev = deviation < 0.001 ? 0.001 : deviation;
    chan.brown = clamp(chan.brown + white * dev * 0.05, -1.0, 1.0);
    return mean + chan.brown;
  }
  if (mode == 3) {
    chan.pink[0] = 0.99886 * chan.pink[0] + white * 0.0555179;
    chan.pink[1] = 0.99332 * chan.pink[1] + white * 0.0750759;
    chan.pink[2] = 0.969   * chan.pink[2] + white * 0.153852;
    chan.pink[3] = 0.8665  * chan.pink[3] + white * 0.3104856;
    chan.pink[4] = 0.55    * chan.pink[4] + white * 0.5329522;
    chan.pink[5] = -0.7616 * chan.pink[5] - white * 0.016898;
    const double out = mean + (chan.pink[0] + chan.pink[1] + chan.pink[2] +
      chan.pink[3] + chan.pink[4] + chan.pink[5] + chan.pink[6] + white * 0.5362) * 0.11;
    chan.pink[6] = white * 0.115926;
    return out;
  }
  if (mode == 4) {
    const double abw = white < 0.0 ? -white : white;
    return mean + (abw > 0.94 ? (white > 0.0 ? deviation : -deviation) : 0.0);
  }
  return mean + white * deviation;
}

}  // namespace

extern "C" int soemdsp_noise_generator_create() {
  for (int i = 0; i < kMaxInstances; i++) {
    if (!gPool[i].active) {
      gPool[i] = NoiseGenState{};
      gPool[i].active = true;
      gPool[i].currentSeed = -1;
      return i + 1;
    }
  }
  return 0;
}

extern "C" void soemdsp_noise_generator_destroy(int handle) {
  if (handle < 1 || handle > kMaxInstances) return;
  gPool[handle - 1].active = false;
}

extern "C" void soemdsp_noise_generator_sample(
  int handle,
  double seedValue,
  int mode,
  double mean,
  double deviation,
  double level
) {
  if (handle < 1 || handle > kMaxInstances) return;
  NoiseGenState& s = gPool[handle - 1];
  const int seed = seedValue < 0.0 ? 0 : (seedValue > 99999.0 ? 99999 : (int)seedValue);
  if (seed != s.currentSeed) {
    s.currentSeed = seed;
    resetChan(s.left,  seedHash(seed, 0));
    resetChan(s.right, seedHash(seed, 1));
  }
  const int safeMode = mode < 0 ? 0 : (mode > 4 ? 4 : mode);
  const double safeDev = deviation < 0.0 ? 0.0 : deviation;
  s.lastLeft  = clamp(channelSample(s.left,  safeMode, mean, safeDev), -1.0, 1.0) * level;
  s.lastRight = clamp(channelSample(s.right, safeMode, mean, safeDev), -1.0, 1.0) * level;
}

extern "C" double soemdsp_noise_generator_left(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastLeft;
}

extern "C" double soemdsp_noise_generator_right(int handle) {
  if (handle < 1 || handle > kMaxInstances) return 0.0;
  return gPool[handle - 1].lastRight;
}

extern "C" int soemdsp_noise_generator_version() {
  return 1;
}
