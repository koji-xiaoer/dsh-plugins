# 粘贴图片转文字（Image Relay）

用户粘贴图片后由服务端转成文字描述再进入会话（供只看文字的模型理解）：

- 优先用智谱 GLM 识别（8 秒超时），未配置 `ZHIPU_API_KEY` 时降级为固定占位文案
- **缓存**：图片字节 sha256 前 24 位作 key，同图秒回，不再重复识别
- DeepSeek 适配器不再拒绝 image 块（图片由 host 代理转文字，适配器放行）

## 包含补丁

| 补丁 | 改动位置 | 内容 |
|---|---|---|
| `dsh-host-apiproxy.patch` | `dsh-host-apiproxy/lib/index.js` | 图片识别 + 缓存逻辑（`[image-relay-patch]` 标记；文件内还含 `[billing-patch]` 的 usageOnly 折叠，见「账单接口优化」） |
| `dsh-llm-deepseek.patch` | `dsh-llm-deepseek/lib/index.js` | DeepSeek 适配器放行 image 块（原为直接抛 `UNSUPPORTED_CONTENT`） |
