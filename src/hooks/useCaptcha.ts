import { useEffect, useState } from "react"
import { backend } from "../frontend/api";

export interface UseCaptchaProps {
    initialUpdate?: boolean
}

export interface CaptchaSource {
    id: string
    imageURL: string
    ready: boolean
    update(): void
}

export default function useCaptcha(props: UseCaptchaProps = { initialUpdate: true }): CaptchaSource {
    const [id, setId] = useState('');
    const [imageURL, setImageURL] = useState('');
    const [ready, setReady] = useState(false);

    function update() {
        backend.getCaptcha().then(([id, url]) => {
            setId(id);
            setImageURL(url);
            setReady(true);
        })
    }

    useEffect(() => {
        if (props.initialUpdate || props.initialUpdate === undefined)
            update();
    }, [])

    return {
        id,
        imageURL,
        ready,
        update
    }
}