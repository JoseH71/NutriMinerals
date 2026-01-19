import React from 'react';

class SafeView extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("View Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center text-rose-500">
                    <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
                    <p className="text-sm font-mono bg-rose-50 p-4 rounded-xl border border-rose-200">
                        {this.state.error?.message || 'Error desconocido'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold"
                    >
                        Reintentar
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default SafeView;
