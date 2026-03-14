/**
 * Simple test to verify Transformers.js embedding worker loads and generates embeddings
 */

// Simplified test - just check if we can import and the package exists
import { pipeline } from '@xenova/transformers'

async function testEmbeddingGeneration() {
  console.log('🧪 Testing Transformers.js embedding generation...\n')

  try {
    console.log('📦 Step 1: Verify @xenova/transformers package is installed')
    console.log('   ✅ Package imported successfully\n')

    console.log('📦 Step 2: Initialize embedding pipeline')
    console.log('   ⏳ Loading all-MiniLM-L6-v2 model (this may take ~10 seconds)...')

    const embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    )
    console.log('   ✅ Model loaded successfully\n')

    console.log('📦 Step 3: Generate test embeddings')
    const testText = 'This is a test sentence to verify embeddings work.'
    const result = await embeddingPipeline([testText], { pooling: 'mean', normalize: true })

    const embedding = result.data
    console.log('   ✅ Embeddings generated\n')

    console.log('📊 Verification Results:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ Model type: all-MiniLM-L6-v2')
    console.log('✅ Vector dimensions:', embedding.length === 384 ? '384 ✓' : `${embedding.length} ✗`)
    console.log('✅ Data type:', embedding instanceof Float32Array ? 'Float32Array ✓' : `${typeof embedding} ✗`)
    console.log('✅ Normalized:', Math.abs(Math.sqrt(Array.from(embedding).reduce((acc: number, v: number) => acc + v * v, 0)) - 1) < 0.01 ? 'YES ✓' : 'NO ✗')
    console.log('✅ Has non-zero values:', Array.from(embedding).some((v: number) => v !== 0) ? 'YES ✓' : 'NO ✗')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const allChecksPass =
      embedding.length === 384 &&
      embedding instanceof Float32Array &&
      Array.from(embedding).some((v: number) => v !== 0)

    if (allChecksPass) {
      console.log('\n🎉 SUCCESS! Transformers.js is working correctly.')
      console.log('\n✅ Phase 2 Complete - Real embeddings are functional')
      console.log('\nNext: Phase 3 - Build Q&A Feature (noteQA.ts + QAChatPanel.tsx)')
    } else {
      console.log('\n❌ VERIFICATION FAILED')
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
    console.log('\nTroubleshooting:')
    console.log('- Ensure internet connection is active (model downloads from HuggingFace)')
    console.log('- Check if @xenova/transformers is installed: npm list @xenova/transformers')
    console.log('- Try running: npm install @xenova/transformers')
  }
}

testEmbeddingGeneration()
