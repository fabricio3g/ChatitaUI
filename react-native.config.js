module.exports = {
  dependencies: {
    // Exclude onnxruntime-react-native from autolinking on Android due to CMake build issues
    // The app will use fallback embedding methods for RAG
    'onnxruntime-react-native': {
      platforms: {
        android: null,
      },
    },
  },
};
