import { Card } from "kbotify"

export default (data: any, link: string) => {
    return new Card({
        "type": "card",
        "theme": "info",
        "size": "lg",
        "modules": [
            {
                "type": "section",
                "text": {
                    "type": "kmarkdown",
                    "content": `** ${(() => {
                        if (data.x_restrict == 0) {
                            return data.title;
                        } else {
                            return `不可以涩涩`
                        }
                    })()
                        }** `
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "kmarkdown",
                        "content": `** [${data.user.name}](https://www.pixiv.net/users/${data.user.uid})**(${data.user.uid}) | [pid ${data.id}](https://www.pixiv.net/artworks/${data.id})`
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "container",
                "elements": [
                    {
                        "type": "image",
                        "src": link
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "kmarkdown",
                        "content": "喜欢 Pixiv酱吗？来 [Bot Market](https://www.botmarket.cn/bots?id=8) 留下一个五星好评吧！\n您也可以在[爱发电](https://afdian.net/@potatopotat0)帮助Pixiv酱的开发！\n[问题反馈&建议](https://kook.top/iOOsLu)"
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "kmarkdown",
                        "content": `${((): string => {
                            if (data.x_restrict == 0) {
                                var str = ""
                                for (const val of data.tags) {
                                    str += `[#${val.name}](https://www.pixiv.net/tags/${val.name.replace(")", "\\)")}/illustrations)${val.translated_name == null ? "" : ` ${val.translated_name}`} `
                                }
                                return str;
                            } else {
                                return "#不可以涩涩";
                            }
                        })()}`
                    }
                ]
            }
        ]
    });
}