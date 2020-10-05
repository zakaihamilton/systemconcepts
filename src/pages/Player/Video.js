export default function Video({ children, ...props }) {
    return <video {...props}>
        {children}
    </video>;
}