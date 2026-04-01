
export const exportData = () => {
    try {
        const data = localStorage.getItem('course-storage');
        if (!data) {
            alert('Nenhum dado encontrado para exportar.');
            return;
        }

        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `afa-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        alert('Falha ao exportar dados.');
    }
};

export const importData = (file: File): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (!content) throw new Error('Arquivo vazio');

                // Basic validation
                const parsed = JSON.parse(content);
                if (!parsed.state || !parsed.version) {
                    throw new Error('Formato de arquivo inválido');
                }

                // Restore
                localStorage.setItem('course-storage', content);

                // Set initialization flag to prevent mock data overwrite
                localStorage.setItem('MOCK_DATA_INITIALIZED', 'true');

                resolve(true);
            } catch (error) {
                console.error('Erro ao importar dados:', error);
                reject(error);
            }
        };
        reader.readAsText(file);
    });
};
