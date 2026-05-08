import { ref } from 'vue'

const useFileLoader = () => {
  // 进度
  const progress = ref(0)
  /**
   * 请求方法
   * @param {*} url 请求地址
   * @returns {Object} 返回数据
   */
  const requestData = async url => {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength, 10);
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];
      
      while(true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (total) {
            progress.value = ((loaded / total) * 100).toFixed(0)
        }
      }
      
      const blob = new Blob(chunks);
      const text = await blob.text();
      const data = JSON.parse(text);
      
      return data
    } catch (error) {
      console.log(error)
    }
  }
  return {
    requestData,
    progress,
  }
}
export default useFileLoader
