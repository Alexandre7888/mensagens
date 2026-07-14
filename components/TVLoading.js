function TVLoading() {
    return (
        <div className="flex h-screen flex-col items-center justify-start bg-gray-900 text-white">
            <div className="mt-[500px]">
                <div className="icon-loader animate-spin text-8xl text-indigo-500"></div>
            </div>
        </div>
    );
}
window.TVLoading = TVLoading;