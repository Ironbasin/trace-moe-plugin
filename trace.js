// Trace.moe 动漫场景搜索插件

import plugin from '../../lib/plugins/plugin.js'
import fetch from 'node-fetch'
import { segment } from 'icqq'

export class TraceMoe extends plugin {
  constructor() {
    super({
      name: '动漫识别',
      dsc: '使用trace.moe API识别动漫截图出处',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#动漫识别$',
          fnc: 'traceMoe'
        }
      ]
    })
  }

  async traceMoe(e) {
    // 获取图片URL
    let img = this.getImageUrl(e)
    
    if (!img) {
      await e.reply('请发送图片+#动漫识别，或引用包含图片的消息')
      return false
    }
    
    await e.reply('正在识别动漫截图，请稍候...')
    
    try {
      // 调用API
      const url = `https://api.trace.moe/search?url=${encodeURIComponent(img)}`
      const response = await fetch(url)
      const res = await response.json()
      
      if (!res.result || res.result.length === 0) {
        await e.reply('未找到匹配的动漫场景，请尝试其他图片')
        return false
      }
      
      // 获取前5个结果
      const results = res.result.slice(0, 5)
      
      // 发送合并转发消息
      try {
        const forwardMsg = await this.makeForwardMsg(e, results, img)
        await e.reply(forwardMsg)
      } catch (err) {
        console.error('合并消息发送失败:', err)
        
        // 降级为普通消息
        const best = results[0]
        const similarity = (best.similarity * 100).toFixed(2)
        const time = this.formatTime(best.from)
        
        await e.reply([
          `动画名称：${best.filename}\n`,
          `相似度：${similarity}%\n`,
          `时间点：${time}\n`,
          segment.image(best.image)
        ])
      }
      
      return true
    } catch (err) {
      console.error(err)
      await e.reply('识别失败，API请求异常')
      return false
    }
  }
  
  // 从消息中获取图片URL
  getImageUrl(e) {
    if (e.source) {
      // 处理引用消息中的图片
      let source
      if (e.isGroup) {
        source = e.group.getChatHistory(e.source.seq, 1)
          .then(res => res && res[0] ? res[0] : null)
          .catch(() => null)
      } else {
        source = e.friend.getChatHistory(e.source.time, 1)
          .then(res => res && res[0] ? res[0] : null)
          .catch(() => null)
      }
      
      if (source && source.message) {
        for (let val of source.message) {
          if (val.type === 'image') return val.url
        }
      }
    }
    
    // 处理当前消息中的图片
    if (e.message) {
      for (let val of e.message) {
        if (val.type === 'image') return val.url
      }
    }
    
    return null
  }
  
  // 构建合并转发消息
  async makeForwardMsg(e, results, originalImg) {
    const forwardMsgs = []
    const botInfo = { nickname: '动漫识别', user_id: e.bot.uin }
    
    // 添加标题
    forwardMsgs.push({
      ...botInfo,
      message: '动漫场景识别结果\n以下是匹配到的动画信息'
    })
    
    // 添加原始图片
    forwardMsgs.push({
      ...botInfo,
      nickname: '原始图片',
      message: segment.image(originalImg)
    })
    
    // 添加匹配结果
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const similarity = (result.similarity * 100).toFixed(2)
      const time = this.formatTime(result.from)
      
      forwardMsgs.push({
        ...botInfo,
        nickname: `匹配结果 ${i+1}`,
        message: [
          segment.text(`匹配结果 ${i+1}\n\n`),
          segment.text(`动画名称: ${result.filename}\n`),
          segment.text(`相似度: ${similarity}%\n`),
          segment.text(`时间点: ${time}\n\n`),
          segment.image(result.image)
        ]
      })
    }
    
    // 添加结尾
    forwardMsgs.push({
      ...botInfo,
      message: '数据来源: trace.moe API'
    })
    
    // 制作合并消息
    if (e.isGroup) {
      return await e.group.makeForwardMsg(forwardMsgs)
    } else if (e.friend) {
      return await e.friend.makeForwardMsg(forwardMsgs)
    }
    
    return forwardMsgs
  }
  
  // 格式化时间
  formatTime(seconds) {
    const min = Math.floor(seconds / 60)
    const sec = Math.floor(seconds % 60)
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }
}