import { Card, AppCommand, AppFunc, BaseSession } from 'kbotify';
import auth from '../../configs/auth';
import * as pixiv from './common';
import axios from 'axios';
const FormData = require('form-data');
const sharp = require('sharp');
const got = require('got');

class Refresh extends AppCommand {
    code = 'refresh'; // 只是用作标记
    trigger = 'refresh'; // 用于触发的文字
    intro = 'Refresh';
    func: AppFunc<BaseSession> = async (session) => {
        console.log(`[${new Date().toLocaleTimeString()}] From ${session.user.nickname} (ID ${session.user.id}), invoke ".pixiv ${this.trigger} ${session.args[0]}"`);
        var loadingBarMessageID: string = "null";
        if (session.args.length === 0) {
            return session.reply("`.pixiv refresh [插画 ID]` 刷新对应 ID 插画的缓存。（当图片显示不正常时，可以在几分钟后运行此命令）")
        } else {
            const illust_id = session.args[0].toString();
            if (pixiv.linkmap.isInDatabase(illust_id)) {
                var rtLink = pixiv.linkmap.getLink(illust_id);
                if (rtLink == "https://img.kaiheila.cn/assets/2022-07/vlOSxPNReJ0dw0dw.jpg") {
                    return session.reply("插画因为 R-18/R-18G 无法刷新缓存");
                }
                var loadingBarMessageID: string;
                console.log(`[${new Date().toLocaleTimeString()}] Refreshing ${illust_id}_0.jpg`);
                axios({
                    url: rtLink,
                    method: "GET"
                }).then((res) => {
                    session.reply("插画可以正常访问！");
                    console.log(`[${new Date().toLocaleTimeString()}] ${illust_id}_0.jpg is normal, skipped.`);
                }).catch(async () => {
                    axios.get(`http://pixiv.lolicon.ac.cn/illustrationDetail?keyword=${illust_id}`, {
                    }).then(async (res: any) => {
                        if (res.data.hasOwnProperty("status") && res.data.status === 404) {
                            return session.reply("插画不存在或已被删除！")
                        }
                        const val = res.data;
                        if (val.x_restrict > 0) {
                            return session.reply("插画因为 R-18/R-18G 无法刷新缓存");
                        }
                        await session.sendCard([{
                            "type": "card",
                            "theme": "warning",
                            "size": "lg",
                            "modules": [
                                {
                                    "type": "section",
                                    "text": {
                                        "type": "kmarkdown",
                                        "content": `正在转存 \`${val.id}_p0.jpg\`，可能需要较长时间:hourglass_flowing_sand:……`
                                    }
                                }
                            ]
                        }]).then((data) => {
                            if (data.msgSent?.msgId !== undefined) {
                                loadingBarMessageID = data.msgSent.msgId;
                            }
                        });
                        const master1200 = val.image_urls.large.replace("i.pximg.net", "i.pixiv.re"); // Get image link
                        console.log(`[${new Date().toLocaleTimeString()}] Resaving... ${master1200}`);
                        var bodyFormData = new FormData();
                        const stream = got.stream(master1200);                                        // Get readable stream from origin
                        var buffer = await sharp(await pixiv.common.stream2buffer(stream)).resize(512).jpeg().toBuffer(); // Resize stream and convert to buffer
                        const detection = await pixiv.nsfwjs.detect(buffer);                          // Detect NSFW
                        var NSFW = false;
                        for (let val of detection) {
                            switch (val.className) {
                                case "Hentai":
                                case "Porn":
                                    if (val.probability > 0.9) buffer = await sharp(buffer).blur(42).jpeg().toBuffer();
                                    else if (val.probability > 0.7) buffer = await sharp(buffer).blur(35).jpeg().toBuffer();
                                    else if (val.probability > 0.5) buffer = await sharp(buffer).blur(21).jpeg().toBuffer();
                                    else if (val.probability > 0.3) buffer = await sharp(buffer).blur(7).jpeg().toBuffer();
                                    if (val.probability > 0.3) NSFW = true;
                                    break;
                                case "Sexy":
                                    if (val.probability > 0.8) buffer = await sharp(buffer).blur(21).jpeg().toBuffer();
                                    else if (val.probability > 0.6) buffer = await sharp(buffer).blur(7).jpeg().toBuffer();
                                    if (val.probability > 0.6) NSFW = true;
                                    break;
                                case "Drawing":
                                case "Natural":
                                default:
                                    break;
                            }
                        }
                        if (NSFW) {
                            console.log(`[${new Date().toLocaleTimeString()}] Image is NSFW, blurred.`);
                            session.updateMessage(loadingBarMessageID, [{
                                "type": "card",
                                "theme": "warning",
                                "size": "lg",
                                "modules": [
                                    {
                                        "type": "section",
                                        "text": {
                                            "type": "kmarkdown",
                                            "content": `\`${val.id}_p0.jpg\` 含有不宜内容，已自动添加模糊。`
                                        }
                                    },
                                    {
                                        "type": "context",
                                        "elements": [
                                            {
                                                "type": "plain-text",
                                                "content": "请避免主动查询 擦边球/R-18/R-18G 插画"
                                            }
                                        ]
                                    }
                                ]
                            }])
                        }
                        bodyFormData.append('file', buffer, "1.jpg");
                        var rtLink = "";
                        //Upload image to KOOK's server
                        await axios({
                            method: "post",
                            url: "https://www.kookapp.cn/api/v3/asset/create",
                            data: bodyFormData,
                            headers: {
                                'Authorization': `Bot ${auth.khltoken}`,
                                ...bodyFormData.getHeaders()
                            }
                        }).then((res: any) => {
                            rtLink = res.data.data.url
                        }).catch((e: any) => {
                            if (e) {
                                session.sendCard(pixiv.cards.error(e));
                            }
                        });

                        var uncensored = false;
                        for (let i = 1; i <= 5; ++i) {
                            await axios({
                                url: rtLink,
                                method: "GET"
                            }).then(() => {
                                uncensored = true;
                            }).catch(async () => {
                                bodyFormData = new FormData();
                                bodyFormData.append('file', await sharp(buffer).blur(14).jpeg().toBuffer(), "1.jpg");
                                await axios({
                                    method: "post",
                                    url: "https://www.kookapp.cn/api/v3/asset/create",
                                    data: bodyFormData,
                                    headers: {
                                        'Authorization': `Bot ${auth.khltoken}`,
                                        ...bodyFormData.getHeaders()
                                    }
                                }).then((res: any) => {
                                    rtLink = res.data.data.url
                                }).catch((e: any) => {
                                    if (e) {
                                        session.sendCard(pixiv.cards.error(e));
                                    }
                                });
                            })
                            if (uncensored) break;
                        }
                        if (!uncensored) {
                            session.updateMessage(loadingBarMessageID, [{
                                "type": "card",
                                "theme": "danger",
                                "size": "lg",
                                "modules": [
                                    {
                                        "type": "section",
                                        "text": {
                                            "type": "kmarkdown",
                                            "content": `给 \`${val.id}_p0.jpg\` 施加了超过 100+px 高斯模糊都救不回来…？属于是世间奇图了，请务必反馈到 Pixiv 酱的交流服务器中`
                                        }
                                    }
                                ]
                            }])
                        }
                        session.updateMessage(loadingBarMessageID, [{ // Send detail
                            "type": "card",
                            "theme": "info",
                            "size": "lg",
                            "modules": [
                                {
                                    "type": "section",
                                    "text": {
                                        "type": "kmarkdown",
                                        "content": `**${val.title}**`
                                    }
                                },
                                {
                                    "type": "context",
                                    "elements": [
                                        {
                                            "type": "kmarkdown",
                                            "content": `**[${val.user.name}](https://www.pixiv.net/users/${val.user.uid})**(${val.user.uid}) | [pid ${val.id}](https://www.pixiv.net/artworks/${val.id})`
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
                                            "src": rtLink
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
                                                var str = ""
                                                for (const vall of val.tags) {
                                                    str += `[#${vall.name}](https://www.pixiv.net/tags/${vall.name}/illustrations) `
                                                }
                                                return str;
                                            })()}`
                                        }
                                    ]
                                }
                            ]
                        }]);
                        pixiv.linkmap.addLink(illust_id, rtLink);
                    }).catch((e: any) => {
                        session.sendCard(pixiv.cards.error(e));
                    });
                })
            } else {
                return session.reply(`此插画（${illust_id}）当前没有缓存！`);
            }
        };
    }
}

export const refresh = new Refresh();

