import { AppCommand, AppFunc, BaseSession } from 'kbotify';
import * as pixiv from './common';
import axios from 'axios';

class Author extends AppCommand {
    code = 'author'; // 只是用作标记
    trigger = 'author'; // 用于触发的文字
    intro = 'Author';
    func: AppFunc<BaseSession> = async (session) => {
        if (pixiv.common.isRateLimited(session, 6, this.trigger)) return;
        pixiv.common.logInvoke(`.pixiv ${this.trigger}`, session);
        async function sendCard(data: any) {
            const loadingBarMessageID = (await session.sendCard(pixiv.cards.resaving("多张图片"))).msgSent?.msgId
            if (loadingBarMessageID == undefined) {
                return pixiv.common.log("Message sending failed");
            }
            var r18: number = 0;
            var link: string[] = [];
            var pid: string[] = [];
            var datas: any[] = [];
            var promises: Promise<any>[] = [];
            for (const k in data) {
                if (data[k].x_restrict !== 0) {
                    continue;
                }
                datas.push(data[k]);
                if (datas.length >= 9) break;
            }
            const detectionResults = await pixiv.aligreen.imageDetectionSync(datas)
            for (const val of datas) {
                promises.push(pixiv.common.uploadImage(val, detectionResults[val.id], session));
            }
            var uploadResults: {
                link: string;
                pid: string;
            }[] = [];
            await Promise.all(promises).then((res) => {
                uploadResults = res;
            }).catch((e) => {
                if (e) {
                    console.error(e);
                    session.sendCardTemp(pixiv.cards.error(e, true));
                }
            });
            for (var val of uploadResults) {
                link.push(val.link);
                pid.push(val.pid);
            }
            while (link.length <= 9) {
                link.push(pixiv.common.akarin);
                pid.push("没有了");
            }
            pixiv.common.log(`Process ended, presenting to user`);
            await session.updateMessage(loadingBarMessageID, [pixiv.cards.author(data[0], r18, link, pid, session, {})]);
        }
        if (session.args.length === 0) {
            return session.reply("使用 `.pixiv help author` 查询指令详细用法")
        } else {
            axios({
                url: `http://pixiv.lolicon.ac.cn/creatorIllustrations`,
                method: "GET",
                params: {
                    keyword: session.args[0]
                }
            }).then((res: any) => {
                if (res.data.length === 0) {
                    return session.reply("用户不存在或此用户没有上传过插画！")
                }
                if (res.data.hasOwnProperty("code") && res.data.code == 400) {
                    return session.reply("请输入一个合法的用户ID（使用 `.pixiv help author` 查询指令详细用法）")
                }
                if (res.data.hasOwnProperty("code") && res.data.code == 500) {
                    return session.reply("Pixiv官方服务器不可用，请稍后再试");
                }
                pixiv.common.getNotifications(session);
                sendCard(res.data);
            }).catch((e: any) => {
                if (e) {
                    console.error(e);
                    session.sendCardTemp(pixiv.cards.error(e, true));
                }
            });
        }
    };
}

export const author = new Author();


