const { build } = require('vite');
const path = require('path');

async function buildApp() {
  try {
    console.log('开始构建React应用...');
    
    const config = {
      configFile: path.resolve(__dirname, './vite.config.ts'),
      root: __dirname,
      mode: 'production',
      build: {
        outDir: path.resolve(__dirname, './dist'),
        emptyOutDir: true,
      }
    };
    
    await build(config);
    console.log('构建完成！');
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

buildApp();