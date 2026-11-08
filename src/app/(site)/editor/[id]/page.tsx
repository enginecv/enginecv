import ClientLoader from "./ClientLoader";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
    return <ClientLoader params={params} />;
}
